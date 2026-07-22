import os
import json
import requests  
import xarray as xr
import imdlib as imd
import planetary_computer  # <-- The new cryptographic hero!
from flask import Flask, Response, request
from flask_cors import CORS
from flask import send_from_directory

app = Flask(__name__)
CORS(app)

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
# 1. IMD GRIDDED DATA PIPELINE
# =====================================================================
@app.route('/api/download')
def download_imd_data():
    start_year = request.args.get('start_year', type=int)
    end_year = request.args.get('end_year', type=int)
    vars_param = request.args.get('vars', type=str)
    out_dir = request.args.get('path', type=str)

    if not start_year or not end_year or not vars_param or not out_dir:
        return {"error": "Missing parameters"}, 400

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

            yield f"data: {json.dumps({'progress': 100, 'message': f'Complete! Files saved to: {out_dir}'})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'progress': 0, 'message': f'Execution failed: {str(e)}'})}\n\n"

    return Response(event_generator(), mimetype='text/event-stream')


# =====================================================================
# 2. COPERNICUS DEM PIPELINE
# =====================================================================
# =====================================================================
# 2. COPERNICUS DEM PIPELINE (WITH REAL-TIME BYTE TRACKING)
# =====================================================================
@app.route('/api/dem')
def extract_dem():
    min_lon = request.args.get('min_lon', type=float)
    min_lat = request.args.get('min_lat', type=float)
    max_lon = request.args.get('max_lon', type=float)
    max_lat = request.args.get('max_lat', type=float)
    out_dir = request.args.get('path', type=str)

    if None in [min_lon, min_lat, max_lon, max_lat, out_dir]:
        return {"error": "Missing coordinate or path parameters"}, 400

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
                
                # Base progress before this specific tile starts downloading
                base_tile_progress = 30 + ((i / total_tiles) * 70)
                yield f"data: {json.dumps({'progress': int(base_tile_progress), 'message': f'Initializing Download: {file_name}...'})}\n\n"
                
                dl_res = requests.get(signed_url, stream=True)
                dl_res.raise_for_status()
                
                # Retrieve the total file size from the server headers
                total_size = int(dl_res.headers.get('content-length', 0))
                downloaded = 0
                chunk_size = 8192
                
                with open(file_path, "wb") as f:
                    for chunk in dl_res.iter_content(chunk_size=chunk_size):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            # Real-time progress math
                            if total_size > 0:
                                file_percent = downloaded / total_size
                                overall_progress = base_tile_progress + (file_percent * (70 / total_tiles))
                                
                                # Prevent SSE flooding: Only send an update to the frontend roughly every 1 Megabyte
                                if downloaded % (1024 * 1024) <= chunk_size:
                                    yield f"data: {json.dumps({'progress': int(overall_progress), 'message': f'Downloading Tile {i+1}/{total_tiles} [{int(file_percent * 100)}%]'})}\n\n"
            
            yield f"data: {json.dumps({'progress': 100, 'message': f'All DEM tiles extracted successfully to: {out_dir}'})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'progress': 0, 'message': f'Pipeline Error: {str(e)}'})}\n\n"

    return Response(generate_progress(), mimetype='text/event-stream')


# =====================================================================
# SERVER STARTUP
# =====================================================================
if __name__ == '__main__':
    print("🚀 GIS Gateway Backend Online! Listening for extraction requests...")
    app.run(port=5000, debug=True)

# Define the path to your frontend folder (one level up, then into 'frontend')
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend'))

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)