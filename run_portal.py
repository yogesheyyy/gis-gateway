import os
import subprocess
import sys
import time

def main():
    # Define absolute paths relative to this runner script
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # ⚠️ Make sure your actual folders are named exactly like this:
    backend_dir = os.path.join(root_dir, "backend")
    frontend_dir = os.path.join(root_dir, "frontend")

    print(" Initializing GIS Data Portal ecosystem...")

    # --- SAFETY CHECKS ---
    if not os.path.exists(backend_dir):
        print(f"\n ERROR: Could not find the backend directory!")
        print(f"Looking for: {backend_dir}")
        print("Please ensure your folder is named 'backend' (lowercase, no spaces).")
        return

    if not os.path.exists(frontend_dir):
        print(f"\n ERROR: Could not find the frontend directory!")
        print(f"Looking for: {frontend_dir}")
        print("Please ensure your HTML/CSS files are inside a folder named 'frontend'.")
        return
    # ---------------------

    # 1. Spawn Flask Backend
    print(" Launching Flask Backend Server on port 5000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=backend_dir
    )

    # 2. Spawn Native HTTP Server for Frontend
    print(" Launching Frontend Web Server on port 8000...")
    frontend_proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", "8000"],
        cwd=frontend_dir
    )

    print("\n Infrastructure fully operational!")
    print(" Open Portal:      http://localhost:8000")
    print(" Backend Pipeline: http://localhost:5000")
    print("\n Press [Ctrl + C] in this terminal to terminate both servers simultaneously.\n")

    try:
        # Keep master script alive to track subprocess execution states
        while True:
            time.sleep(1)
            
            if backend_proc.poll() is not None:
                print("\n Backend server stopped unexpectedly. Check app.py for errors.")
                break
            if frontend_proc.poll() is not None:
                print("\n Frontend server stopped unexpectedly.")
                break
                
    except KeyboardInterrupt:
        print("\n Catching shutdown signal. Terminating server instances...")
    finally:
        # Clean up both operational branches automatically
        backend_proc.terminate()
        frontend_proc.terminate()
        backend_proc.wait()
        frontend_proc.wait()
        print("System successfully powered down.")

if __name__ == "__main__":
    main()