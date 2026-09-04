import "./DocumentViewer.css";

export default function DocumentViewer({ setSelectedDoc }: any) {
  return (
    <div className="doc-viewer">

      {/* TOP HEADER */}
      <div className="doc-header">
        <h2>TEST TRAINING ⭐</h2>

        <div className="doc-actions">
          <span className="download">⬇ Download</span>
		  <span className="back" onClick={() => setSelectedDoc(null)}>
		    ⬅ Back
		  </span>
        </div>
      </div>

      {/* FILE LOCATION */}
      <p className="location">
        <b>File Location:</b> /TRAINING/COMMON
      </p>

      {/* DETAILS GRID */}
      <div className="doc-details">

        {/* LEFT */}
        <div className="left">
          <p><b>Owner:</b> Maxine Lai</p>
          <p><b>Description:</b> -</p>
          <p><b>Version:</b> -</p>
          <p><b>Version Date:</b> -</p>
        </div>

        {/* RIGHT */}
        <div className="right">
          <p><b>Effective Date:</b> -</p>
          <p><b>IRB OK Date:</b> -</p>
          <p><b>Sponsor OK Date:</b> -</p>
          <p><b>Expiration Date:</b> -</p>
          <p><b>Expiration Alert:</b> -</p>
        </div>

      </div>

      {/* DOWNLOAD BUTTON */}
      <div className="download-box">
        <button className="download-btn">
          Download with Signatures
        </button>
      </div>

    </div>
  );
}