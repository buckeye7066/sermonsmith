import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let type = 'sermon';
    try {
      const body = await req.json();
      type = body.type || 'sermon';
    } catch (e) {
      // If JSON parsing fails, use default
    }

    const suggestions = {
      sermon: [
        "Grace and Forgiveness",
        "Living a Life of Faith",
        "The Power of Prayer",
        "Walking in God's Love",
        "Overcoming Adversity"
      ],
      study: [
        "Fruit of the Spirit",
        "The Gospel of John",
        "Old Testament Prophecy",
        "Christian Ethics",
        "Prayer and Fasting"
      ],
      quiz: [
        "New Testament Books",
        "Life of Jesus",
        "The Apostle Paul",
        "Miracles in the Bible",
        "Old Testament Heroes"
      ]
    };

    return Response.json({
      suggestions: suggestions[type] || suggestions.sermon
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});