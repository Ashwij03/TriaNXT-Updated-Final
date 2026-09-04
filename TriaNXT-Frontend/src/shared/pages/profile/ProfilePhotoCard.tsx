import { useMemo, useState } from "react";
import DashboardCard from "../../components/dashboard/shared/DashboardCard";
import {
  clearProfilePhoto,
  getCurrentUser,
  getUserProfile,
  syncProfilePhoto
} from "../../services/roleService";

const MAX_DIMENSION = 512; // longest edge, in px
const JPEG_QUALITY = 0.8;
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB original file safety cap

function resizeImageFile(file, maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read the selected file."));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () =>
        reject(new Error("Could not process the selected image."));

      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

function ProfilePhotoCard({
  photo,
  onPhotoChange,
  deferSync = false,
  showCard = true,
  compact = false
}: any) {
  const currentUser = getCurrentUser();
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const avatarInitial = useMemo(() => {
    const profile = getUserProfile();
    return (
      profile.firstName?.charAt(0)?.toUpperCase() ||
      currentUser?.name?.charAt(0)?.toUpperCase() ||
      "U"
    );
  }, [currentUser?.name]);

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setIsError(true);
      setMessage("That image is too large. Please choose a file under 8MB.");
      return;
    }

    try {
      const image = await resizeImageFile(file);
      onPhotoChange?.(image);

      if (!deferSync) {
        syncProfilePhoto(image, currentUser);
        setIsError(false);
        setMessage("Profile photo updated.");
      } else {
        setIsError(false);
        setMessage("");
      }
    } catch (error) {
      setIsError(true);
      setMessage(
        error?.message ||
          "Could not save the photo. Please try a smaller image."
      );
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange?.("");

    try {
      clearProfilePhoto(currentUser);
      setIsError(false);
      setMessage("Profile photo removed.");
    } catch (error) {
      setIsError(true);
      setMessage(error?.message || "Failed to remove profile photo.");
    }
  };

  const content = (
    <div className="profile-avatar-row">
      {photo ? (
        <img src={photo} alt="Profile" className="profile-avatar-image" />
      ) : (
        <div className="profile-avatar-circle">{avatarInitial}</div>
      )}
      <div className="profile-photo-actions">
        <label className="profile-photo-upload">
          Upload Photo
          <input type="file" accept="image/*" onChange={handlePhotoUpload} />
        </label>
        {photo && (
          <button
            type="button"
            className="secondary-btn"
            onClick={handleRemovePhoto}>

            Remove Photo
          </button>
        )}
        {!compact && (
          <p className="profile-photo-help">
            
          </p>
        )}
        {message && (
          <p style={{ color: isError ? "#dc2626" : "#059669", margin: 0 }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <DashboardCard title="Profile Photo" className="profile-photo-card">
      {content}
    </DashboardCard>
  );
}

export default ProfilePhotoCard;