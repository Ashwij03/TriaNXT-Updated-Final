import EmojiPicker from "emoji-picker-react";
import { useRef, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import {
  getRoleLiveChatData,
  saveRoleLiveChatData,
} from "../services/liveChatService";
import "../../PI/styles/PILiveChat.css";

function RoleLiveChatPage({ onBack, role, backLabel = "Back to Dashboard" }: any) {
  const [selectedUser, setSelectedUser] = useState(0);
  const [searchUser, setSearchUser] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef(null);

  const initialData = getRoleLiveChatData(role);
  const [chatData, setChatData] = useState(initialData.conversations);
  const [message, setMessage] = useState("");

  const persistChat = (updated) => {
    setChatData(updated);
    saveRoleLiveChatData({ conversations: updated }, role);
  };

  const activeChat = chatData[selectedUser] || chatData[0];

  const sendMessage = () => {
    if (!message.trim() || !activeChat) {
      return;
    }

    const updated = [...chatData];
    const idx = Math.min(selectedUser, updated.length - 1);

    updated[idx].messages.push({
      sender: "me",
      text: message,
      time: new Date().toLocaleTimeString(),
    });
    updated[idx].unread = 0;

    persistChat(updated);
    setMessage("");
  };

  const handleEndChat = () => {
    if (activeChat) {
      const updated = [...chatData];
      const idx = Math.min(selectedUser, updated.length - 1);
      updated[idx].unread = 0;
      updated[idx].messages.push({
        sender: "system",
        text: "Conversation ended.",
        time: new Date().toLocaleTimeString(),
      });
      persistChat(updated);
    }
    if (onBack) {
      onBack();
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  if (!activeChat) {
    return (
      <div className="pi-page-content">
        <button type="button" className="pi-chat-back-btn" onClick={handleBack}>
          <FiArrowLeft /> {backLabel}
        </button>
        <p>No conversations available.</p>
      </div>
    );
  }

  return (
    <div className="pi-page-content pi-live-chat-page">
      <button type="button" className="pi-chat-back-btn" onClick={handleBack}>
        <FiArrowLeft /> {backLabel}
      </button>

      <div className="chat-container">
        <div className="chat-sidebar">
          <h3>Live Chat</h3>
          <div className="chat-search">
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchUser}
              onChange={(event) => setSearchUser(event.target.value)}
            />
          </div>
          <div className="chat-tabs">
            <button
              type="button"
              className={activeTab === "all" ? "active" : ""}
              onClick={() => setActiveTab("all")}
            >
              All
            </button>
            <button
              type="button"
              className={activeTab === "unread" ? "active" : ""}
              onClick={() => setActiveTab("unread")}
            >
              Unread
            </button>
            <button
              type="button"
              className={activeTab === "resolved" ? "active" : ""}
              onClick={() => setActiveTab("resolved")}
            >
              Resolved
            </button>
          </div>

          {chatData
            .filter((chat) => {
              const matchesSearch = chat.name
                .toLowerCase()
                .includes(searchUser.toLowerCase());

              if (activeTab === "unread") {
                return matchesSearch && chat.unread > 0;
              }
              if (activeTab === "resolved") {
                return matchesSearch && chat.unread === 0;
              }
              return matchesSearch;
            })
            .map((chat) => {
              const index = chatData.indexOf(chat);
              return (
                <div
                  key={chat.id}
                  className={`chat-user ${selectedUser === index ? "active" : ""}`}
                  onClick={() => setSelectedUser(index)}
                >
                  <div className="user-details">
                    <div className="avatar">{chat.name.charAt(0)}</div>
                    <div className="user-details">
                      <strong>{chat.name}</strong>
                      <small>
                        {chat.messages[chat.messages.length - 1]?.text ||
                          "No messages"}
                      </small>
                    </div>
                  </div>
                  {chat.unread > 0 && (
                    <span className="badge">{chat.unread}</span>
                  )}
                </div>
              );
            })}
        </div>

        <div className="chat-main">
          <div className="chat-header">
            <div className="header-left">
              <div className="avatar large">{activeChat.name.charAt(0)}</div>
              <div>
                <h4>{activeChat.name}</h4>
                <span className="online">● Online</span>
              </div>
            </div>

            <div className="header-actions">
              <button type="button" className="end-chat-btn" onClick={handleEndChat}>
                End Chat
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {activeChat.messages.map((msg, index) => (
              <div
                key={index}
                className={`message ${
                  msg.sender === "me"
                    ? "sent"
                    : msg.sender === "system"
                      ? "system"
                      : "received"
                }`}
              >
                {msg.file ? (
                  msg.type?.startsWith("image/") ? (
                    <img src={msg.url} alt={msg.name} className="chat-image" />
                  ) : (
                    <div className="file-card">📎 {msg.name}</div>
                  )
                ) : (
                  <p>{msg.text}</p>
                )}
                <small>
                  {msg.time}
                  {msg.sender === "me" ? " ✓✓" : ""}
                </small>
              </div>
            ))}
          </div>

          {showEmoji && (
            <div className="emoji-picker">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  setMessage((prev) => prev + emojiData.emoji);
                }}
              />
            </div>
          )}

          <div className="chat-input">
            <button
              type="button"
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              +
            </button>

            <input
              type="text"
              placeholder="Type message..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
            />

            <button
              type="button"
              className="emoji-btn"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              😀
            </button>

            <button type="button" className="send-btn" onClick={sendMessage}>
              Send
            </button>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(event) => {
                const file = event.target.files[0];
                if (file) {
                  const url = URL.createObjectURL(file);
                  const updated = [...chatData];
                  updated[selectedUser].messages.push({
                    sender: "me",
                    file: true,
                    name: file.name,
                    type: file.type,
                    url,
                    time: new Date().toLocaleTimeString(),
                  });
                  persistChat(updated);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoleLiveChatPage;
