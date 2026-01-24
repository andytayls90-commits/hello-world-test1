// Select the button and the body elements
const button = document.getElementById('magic-btn');
const body = document.body;
const h1 = document.querySelector('h1');

// An array of beautiful gradient colors
const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)'
];

let currentIndex = 0;

// Function to handle the click
function handleClick() {
    // Pick the next gradient
    currentIndex = (currentIndex + 1) % gradients.length;

    // Apply the new background
    body.style.background = gradients[currentIndex];

    // Change the text excitingly
    h1.innerText = "You clicked it!";

    // Reset text after 2 seconds
    setTimeout(() => {
        h1.innerText = "Hello User!";
    }, 2000);
}

// Add the 'click' event listener to the button
button.addEventListener('click', handleClick);
