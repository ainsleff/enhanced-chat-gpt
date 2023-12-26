const { storage, ref, uploadBytes, getDownloadURL } = require('~/server/services/Files/images');
const fetch = require('node-fetch');

async function saveImageToFirebaseStorage(userId, imageUrl, imageName) {
  const storageRef = ref(storage, `images/${userId.toString()}/${imageName}`);

  // Upload image to Firebase Storage using the image URL
  await uploadBytes(storageRef, await fetch(imageUrl).then((response) => response.buffer()));

  return imageName;
}

async function getFirebaseStorageImageUrl(imageName) {
  // Get the download URL for the image from Firebase Storage
  const storageRef = ref(storage, `images/${imageName}`);
  return `![generated image](${await getDownloadURL(storageRef)})`;
}

module.exports = {
  saveImageToFirebaseStorage,
  getFirebaseStorageImageUrl,
  imageNameFirebase: null,
};
