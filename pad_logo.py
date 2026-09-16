from PIL import Image

def pad_image(input_path, output_path, padding_factor):
    """Adds a white border around the image to prevent it from being cropped."""
    img = Image.open(input_path).convert("RGB")
    width, height = img.size
    
    # Calculate new safe canvas size
    new_width = int(width * padding_factor)
    new_height = int(height * padding_factor)
    
    # Create white canvas
    new_img = Image.new("RGB", (new_width, new_height), (255, 255, 255))
    
    # Calculate offset to center the original image
    offset_x = (new_width - width) // 2
    offset_y = (new_height - height) // 2
    
    # Paste
    new_img.paste(img, (offset_x, offset_y))
    new_img.save(output_path, "JPEG", quality=95)
    print(f"Saved padded image to {output_path} (size: {new_width}x{new_height})")

if __name__ == "__main__":
    logo_path = "/home/joshua/Desktop/project0/app/zeroo/assets/images/applogo.jpeg"
    # To reduce clipping by circular adaptative icons, a 1.5x padding usually works.
    pad_image(logo_path, logo_path, 1.45)
