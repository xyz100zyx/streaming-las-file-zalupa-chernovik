import { useCallback, useState } from "react";
import "./App.css";
import { PointCloudViewer } from "./components";

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.name.endsWith(".las")) {
        setSelectedFile(file);
      } else {
        alert("Please select a .las file");
      }
    },
    [],
  );

  return (
    <div className="App">
      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          zIndex: 1000,
          background: "white",
          padding: "10px",
          borderRadius: "5px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <input
          type="file"
          accept=".las"
          onChange={handleFileChange}
          style={{ marginBottom: "10px" }}
        />
        {selectedFile && (
          <div style={{ fontSize: "12px", color: "#666" }}>
            Selected: {selectedFile.name} (
            {Math.round(selectedFile.size / 1024 / 1024)} MB)
          </div>
        )}
      </div>

      <PointCloudViewer
        file={selectedFile}
        pointSize={0.03}
        maxWorkers={navigator.hardwareConcurrency || 4}
      />
    </div>
  );
}

export default App;
