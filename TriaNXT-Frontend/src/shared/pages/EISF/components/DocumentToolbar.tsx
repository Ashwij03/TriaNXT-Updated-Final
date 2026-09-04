import "./DocumentToolbar.css";

export default function DocumentToolbar({
  search,
  onSearch,
  onUpload
}: any) {
  return (
    <div className="document-toolbar">

      <div className="toolbar-left">

        <input
          type="text"
          placeholder="Search documents..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />

        <select defaultValue="">
          <option value="">Status : All</option>
          <option>Approved</option>
          <option>Pending</option>
          <option>Draft</option>
          <option>Expired</option>
        </select>

        <select defaultValue="">
          <option value="">Category : All</option>
          <option>Contact List</option>
          <option>Delegation Log</option>
          <option>CV</option>
          <option>Training</option>
        </select>

      </div>

      <div className="toolbar-right">

        <button className="reset-btn">
          Reset
        </button>

        <button
          className="upload-btn"
          onClick={onUpload}>

          + Upload Document
        </button>

      </div>

    </div>
  );
}