// Client-side tarot interpretation functions

async function getCardInterpretation(question, cards) {
    try {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.className = 'loading';
      loadingIndicator.textContent = '正在解读...';
      document.getElementById('aiResponse').innerHTML = '';
      document.getElementById('aiResponse').appendChild(loadingIndicator);
  
      // Use environment-dependent URL instead of hardcoded one
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000/api/interpret'
        : '/api/interpret'; // Will use relative path on production
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: question,
          cards: cards
        })
      });
  
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
  
      document.getElementById('aiResponse').innerHTML = formatTarotResponse(data.result);
    } catch (error) {
      document.getElementById('aiResponse').innerHTML = `<div class="error">解读失败: ${error.message}</div>`;
    }
  }
  
  // Helper function to format the response with nicer styling
  function formatTarotResponse(text) {
    // Split by paragraphs and wrap them in proper HTML
    return text.split('\n\n')
      .map(paragraph => {
        // Check if it's a heading
        if (paragraph.startsWith('#')) {
          const level = paragraph.match(/^#+/)[0].length;
          const content = paragraph.replace(/^#+\s*/, '');
          return `<h${level}>${content}</h${level}>`;
        }
        return `<p>${paragraph}</p>`;
      })
      .join('');
  }