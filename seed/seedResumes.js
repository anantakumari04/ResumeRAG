import mongoose from "mongoose";
import dotenv from "dotenv";
import Resume from "../models/Resume.js";
import Job from "../models/Job.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const seedData = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // clear old data
    await Resume.deleteMany();
    await Job.deleteMany();

    const resumes = await Resume.insertMany([
      {
        name: "Alice Johnson",
        email: "alice@example.com",
        skills: ["React", "Node.js", "MongoDB", "JavaScript"],
        experience: "3 years full-stack developer",
        text: "Experienced MERN developer skilled in React, Express, Node.js and MongoDB."
      },
      {
        name: "Bob Smith",
        email: "bob@example.com",
        skills: ["Python", "Flask", "Machine Learning", "Data Science"],
        experience: "4 years data scientist",
        text: "Data scientist specializing in predictive modeling and NLP."
      }
    ]);

    const jobs = await Job.insertMany([
      {
        title: "Full-Stack Developer",
        description: "Looking for a full-stack MERN developer to build web applications.",
        skillsRequired: ["React", "Node.js", "MongoDB"]
      },
      {
        title: "Data Scientist",
        description: "Need ML engineer with experience in NLP and Python.",
        skillsRequired: ["Python", "Machine Learning", "NLP"]
      }
    ]);

    console.log("✅ Seeded Resumes:", resumes.length);
    console.log("✅ Seeded Jobs:", jobs.length);

    mongoose.connection.close();
    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding:", err);
    process.exit(1);
  }
};

seedData();
