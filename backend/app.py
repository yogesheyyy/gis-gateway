import os
import json
import io
import zipfile
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests  
import xarray as xr
import imdlib as imd
import planetary_computer  # <-- The cryptographic hero!
from flask import Flask, Response, request, send_file, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Define the path to your frontend folder (one level up, then into 'frontend')
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend'))

# =====================================================================
# IMD HELPER FUNCTION
# =====================================================================
def save_netcdf(ds, var, out_file):
    try:
        import netCDF4
        encoding = {var: {"zlib": True, "complevel": 5, "dtype": "float32"}}
        ds.to_netcdf(out_file, engine="netcdf4", format="NETCDF4", encoding=encoding)
        return "Saved with zlib compression"
    except ModuleNotFoundError:
        ds.to_netcdf(out_file, engine="scipy")
        return "Saved without compression"


# =====================================================================
# FILE ARCHIVER (ZIP HELPER) FOR BROWSER DOWNLOADS
# =====================================================================
@app.route('/api/download-zip')
def download_zip():
    folder_path = request.args.get('path', type=str)
    if not folder_path or not os.path.exists(folder_path):
        return {"error": "Invalid or missing folder path"}, 400
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(folder_path):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, folder_path)
                zf.write(file_path, arcname)
    
    memory_file.seek(0)
    zip_name = os.path.basename(folder_path) + "_archive.zip"
    return send_file(
        memory_file, 
        mimetype='application/zip', 
        as_attachment=True, 
        download_name=zip_name
    )


# =====================================================================
# 1. IMD GRIDDED DATA PIPELINE
# =====================================================================
@app.route('/api/download')
def download_imd_data():
    start_year = request.args.get('start_year', type=int)
    end_year = request.args.get('end_year', type=int)
    vars_param = request.args.get('vars', type=str)
    out_dir = request.args.get('path', type=str)

    if not out_dir:
        out_dir = os.path.join(os.getcwd(), 'downloads')

    if not start_year or not end_year or not vars_param:
        return {"error": "Missing required parameters (start_year, end_year, vars)"}, 400

    variables = vars_param.split(',')

    def event_generator():
        try:
            os.makedirs(out_dir, exist_ok=True)
            yield f"data: {json.dumps({'progress': 5, 'message': f'Initializing workspace for {start_year}-{end_year}...'})}\n\n"

            progress_step = 90 / len(variables)

            for idx, var in enumerate(variables):
                base_progress = int(5 + (idx * progress_step))
                
                actual_start = start_year
                if var in ["tmin", "tmax"] and start_year < 1951:
                    if end_year < 1951:
                        yield f"data: {json.dumps({'progress': base_progress, 'message': f'Skipping {var.upper()} (No data available before 1951)'})}\n\n"
                        continue
                    else:
                        actual_start = 1951
                        yield f"data: {json.dumps({'progress': base_progress, 'message': f'Adjusting {var.upper()} start to 1951...'})}\n\n"

                try:
                    yield f"data: {json.dumps({'progress': base_progress + (progress_step * 0.2), 'message': f'Downloading source files for {var.upper()} ({actual_start}-{end_year})...'})}\n\n"
                    
                    imd.get_data(var_type=var, start_yr=actual_start, end_yr=end_year, fn_format="yearwise", file_dir=out_dir)

                    yield f"data: {json.dumps({'progress': base_progress + (progress_step * 0.6), 'message': f'Parsing gridded layers into xarray ({var.upper()})...'})}\n\n"
                    
                    data = imd.open_data(var_type=var, start_yr=actual_start, end_yr=end_year, fn_format="yearwise", file_dir=out_dir)
                    
                    ds = data.get_xarray()
                    old_var_name = list(ds.data_vars)[0]
                    ds = ds.rename({old_var_name: var})
                    ds[var] = ds[var].astype("float32")

                    if var == "rain":
                        ds[var].attrs["long_name"] = "IMD Daily Rainfall"
                        ds[var].attrs["units"] = "mm/day"
                    elif var == "tmin":
                        ds[var].attrs["long_name"] = "IMD Daily Minimum Temperature"
                        ds[var].attrs["units"] = "degree_Celsius"
                    elif var == "tmax":
                        ds[var].attrs["long_name"] = "IMD Daily Maximum Temperature"
                        ds[var].attrs["units"] = "degree_Celsius"

                    ds.attrs["source"] = "India Meteorological Department gridded data"
                    ds.attrs["created_using"] = "imdlib and xarray"
                    ds.attrs["period"] = f"{actual_start}-{end_year}"
                    
                    out_file = os.path.join(out_dir, f"{var}_{actual_start}_{end_year}.nc")

                    yield f"data: {json.dumps({'progress': base_progress + (progress_step * 0.9), 'message': f'Writing to local NetCDF file ({var.upper()})...'})}\n\n"
                    save_netcdf(ds, var, out_file)
                    
                except Exception as e:
                    yield f"data: {json.dumps({'progress': base_progress + progress_step, 'message': f'Warning: Failed to process {var.upper()}: {str(e)}'})}\n\n"

            # Final success event includes the download url for the zip package
            zip_url = f"/api/download-zip?path={out_dir}"
            yield f"data: {json.dumps({'progress': 100, 'message': f'Complete! Preparing download...', 'download_url': zip_url})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'progress': 0, 'message': f'Execution failed: {str(e)}'})}\n\n"

    return Response(event_generator(), mimetype='text/event-stream')


# =====================================================================
# 2. COPERNICUS DEM PIPELINE
# =====================================================================
@app.route('/api/dem')
def extract_dem():
    min_lon = request.args.get('min_lon', type=float)
    min_lat = request.args.get('min_lat', type=float)
    max_lon = request.args.get('max_lon', type=float)
    max_lat = request.args.get('max_lat', type=float)
    out_dir = request.args.get('path', type=str)

    if not out_dir:
        out_dir = os.path.join(os.getcwd(), 'dem_downloads')

    if None in [min_lon, min_lat, max_lon, max_lat]:
        return {"error": "Missing coordinate parameters"}, 400

    def generate_progress():
        try:
            yield f"data: {json.dumps({'progress': 10, 'message': 'Initializing Microsoft STAC catalog query...'})}\n\n"
            
            if not os.path.exists(out_dir):
                os.makedirs(out_dir)

            search_url = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
            payload = {
                "collections": ["cop-dem-glo-30"],
                "bbox": [min_lon, min_lat, max_lon, max_lat]
            }
            
            response = requests.post(search_url, json=payload)
            response.raise_for_status() 
            features = response.json().get("features", [])
            
            if not features:
                yield f"data: {json.dumps({'progress': 0, 'message': 'Error: No DEM tiles found for this bounding box.'})}\n\n"
                return

            total_tiles = len(features)
            yield f"data: {json.dumps({'progress': 30, 'message': f'Found {total_tiles} tile(s). Signing access tokens...'})}\n\n"

            for i, feature in enumerate(features):
                tif_url = feature["assets"]["data"]["href"]
                signed_url = planetary_computer.sign(tif_url)
                file_name = tif_url.split("/")[-1]
                file_path = os.path.join(out_dir, file_name)
                
                base_tile_progress = 30 + ((i / total_tiles) * 70)
                yield f"data: {json.dumps({'progress': int(base_tile_progress), 'message': f'Initializing Download: {file_name}...'})}\n\n"
                
                dl_res = requests.get(signed_url, stream=True)
                dl_res.raise_for_status()
                
                total_size = int(dl_res.headers.get('content-length', 0))
                downloaded = 0
                chunk_size = 8192
                
                with open(file_path, "wb") as f:
                    for chunk in dl_res.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if total_size > 0:
                                file_percent = downloaded / total_size
                                overall_progress = base_tile_progress + (file_percent * (70 / total_tiles))
                                
                                if downloaded % (1024 * 1024) <= chunk_size:
                                    yield f"data: {json.dumps({'progress': int(overall_progress), 'message': f'Downloading Tile {i+1}/{total_tiles} [{int(file_percent * 100)}%]'})}\n\n"
            
            # Final success event includes the download url for the zip package
            zip_url = f"/api/download-zip?path={out_dir}"
            yield f"data: {json.dumps({'progress': 100, 'message': f'All DEM tiles extracted successfully!', 'download_url': zip_url})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'progress': 0, 'message': f'Pipeline Error: {str(e)}'})}\n\n"

    return Response(generate_progress(), mimetype='text/event-stream')


# =====================================================================
# 3. CONTACT FORM EMAIL PIPELINE (ZOHO MAIL)
# =====================================================================
@app.route('/api/send-email', methods=['POST'])
def send_email():
    try:
        data = request.json
        sender_email = data.get('email')
        sender_name = data.get('name', 'Anonymous')
        message_body = data.get('message')

        if not sender_email or not message_body:
            return {"success": False, "message": "Email and message are required."}, 400

        smtp_server = "smtp.zoho.in"
        smtp_port = 465
        zoho_user = "contact@gisgateway.co.in"
        zoho_password = "H9g13uRr5fQj"  # Temporarily hardcoded without spaces

        if not zoho_password:
            return {"success": False, "message": "Email configuration missing on server (ZOHO_MAIL_PASSWORD not set)."}, 500

        # Construct the email
        msg = MIMEMultipart()
        msg['From'] = zoho_user
        msg['To'] = zoho_user
        msg['Reply-To'] = sender_email
        msg['Subject'] = f"New Message from GIS Gateway: {sender_name}"

        body = f"Sender Name/Handle: {sender_name}\nSender Email: {sender_email}\n\nMessage:\n{message_body}"
        msg.attach(MIMEText(body, 'plain'))

        # Send via Zoho SSL port
        with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
            server.login(zoho_user, zoho_password)
            server.sendmail(zoho_user, zoho_user, msg.as_string())

        return {"success": True, "message": "Email sent successfully!"}
    except Exception as e:
        return {"success": False, "message": str(e)}, 500


# =====================================================================
# FRONTEND STATIC ROUTES
# =====================================================================
@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# =====================================================================
# SERVER STARTUP
# =====================================================================
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    print(f"🚀 GIS Gateway Backend Online! Listening on port {port}...")
    app.run(host="0.0.0.0", port=port)