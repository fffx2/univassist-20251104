const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method Not Allowed' })
    };
  }

  try {
    const { bgColor, textColor } = JSON.parse(event.body);

    const systemPrompt = `You are a UI color design assistant. A user is testing color combinations.

    User's current selection:
    - Background Color: ${bgColor}
    - Text Color: ${textColor}
    
    Based on this, please provide:
    1.  An analysis of their current combination's contrast ratio and WCAG AA compliance (for normal text).
    2.  Recommendations for a better text color (if the current one fails or is poor) on the given background.
    3.  Recommendations for a good "accent" or "call-to-action" color that works well with the current background.
    
    Return a valid JSON object with the following structure:
    
    {
      "currentAnalysis": {
        "contrastRatio": "Calculate WCAG contrast ratio.",
        "wcagAANormal": "Pass/Fail (AA for normal text)",
        "comment": "Brief analysis of the current combination."
      },
      "recommendations": {
        "accessibleTextColor": {
          "hex": "#...",
          "comment": "A text color that passes WCAG AA on the background."
        },
        "accentColor": {
          "hex": "#...",
          "comment": "An accent color that complements the background."
        }
      },
      "reasoning": "A brief, natural-language explanation for these recommendations."
    }
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-1106",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze and recommend colors." }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 500
    });

    const result = JSON.parse(completion.choices[0].message.content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Failed to get AI recommendations', error: error.message })
    };
  }
};