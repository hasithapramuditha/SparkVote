require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User.model');
const Event = require('./models/Event.model');
const Vote = require('./models/Vote.model');

const MONGO_URI = process.env.MONGO_URI;

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Clear existing data
    await Vote.deleteMany();
    await Event.deleteMany();
    await User.deleteMany();

    // Create admin user
    const admin = new User({
      username: 'admin',
      password: 'admin123',
      email: 'admin@example.com'
    });
    await admin.save();
    console.log('Admin user created');

    // Create sample event
    const event = new Event({
      name: 'Sample Hackathon',
      description: 'A fun hackathon event for testing.',
      date: '2024-12-01',
      startTime: '09:00',
      closeTime: '18:00',
      owner: admin._id,
      groups: [
        { name: 'Judges', weight: 60, password: 'judgepass' },
        { name: 'Participants', weight: 40 }
      ],
      projects: [
        { name: 'Project Alpha', description: 'A project about AI.' },
        { name: 'Project Beta', description: 'A project about Blockchain.' }
      ],
      criteria: [
        { name: 'Creativity', maxScore: 10 },
        { name: 'Execution', maxScore: 10 },
        { name: 'Impact', maxScore: 10 }
      ]
    });
    await event.save();
    console.log('Sample event created');

    // Optionally, create some sample votes here if needed

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeder error:', error);
    process.exit(1);
  }
};

seed(); 