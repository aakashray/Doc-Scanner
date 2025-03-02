# Document Scanner 📜✨


A **self-contained document scanning and matching system** with a built-in credit system, designed for efficiency and scalability. Built with pure HTML, CSS, and Node.js, this project features SENTENCE_TRANSFORMERS, a python library, a sleek animated frontend, and a robust admin dashboard—all without relying on third-party frameworks.

---

## 🚀 Features

- **User Authentication**: Secure registration and login with hashed passwords (bcrypt).
- **Credit System**:
  - 20 free scans daily per user (auto-resets at midnight).
  - Users can request additional credits; admins approve exact amounts.
- **Document Scanning & Matching**:
  - Upload plain text files for scanning.
  - Pre-trained embedding model(based on BERT) helps identify the matches. (threshold: 0.8).
- **Smart Analytics Dashboard**:
  - Tracks scans, credits, and user activity for admins.
  - Displays pending credit requests with one-click approval.
- **Frontend Design**:
  - Modern UI with gradient backgrounds, card layouts, and subtle animations (fade-in, slide-up, pulse, bounce).
  - No frameworks—just pure HTML/CSS magic!

---

## 🛠 Tech Stack

| Layer         | Technology                     |
|---------------|--------------------------------|
| **Frontend**  | HTML, CSS, JavaScript         |
| **Backend**   | Node.js (Express)             |
| **Database**  | SQLite                        |
| **File Storage** | Local filesystem (`uploads/`) |
| **Local**        | Sentence_Transformer(Python library)       |
| **Security**  | bcryptjs for password hashing |

---

## 🎬 Demo

1. **Login/Register**: Fade-in animation welcomes users.
2. **Scan a Document**: Credits bounce as they deduct, matches slide up.
3. **Request Credits**: Admins see pending requests with a pulsing "Approve" button.
4. **Admin Analytics**: Real-time user stats in a sleek card layout.

---

## 🏃‍♂️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org) (v20.13.0 or later)
- Python and Sentence_Transformers installed on your system (Write 'pip3 install sentence-transformers' in your terminal)

### Installation
1. **Clone the Repository**:
   ```bash
   git clone https://github.com/aakashray/doc-scanner.git
   cd doc-scanner