// Client-side tarot interpretation functions

async function getCardInterpretation(question, cards) {
  try {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading';
    loadingIndicator.textContent = '正在解读...';
    document.getElementById('aiResponse').innerHTML = '';
    document.getElementById('aiResponse').appendChild(loadingIndicator);

    // Use environment-dependent URL
    const apiBaseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'https://tarot-reading-git-master-vivis-projects-121260c4.vercel.app/api'
      : '/api';
    
    // Step 1: Submit the job
    const submitResponse = await fetch(`${apiBaseUrl}/interpret`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        cards: cards
      })
    });

    const jobData = await submitResponse.json();
    
    if (!submitResponse.ok) {
      throw new Error(jobData.error || '提交解读任务失败');
    }

    const jobId = jobData.jobId;
    
    // Update loading message
    loadingIndicator.textContent = '解读中，请稍候...';
    
    // Step 2: Poll for results
    const result = await pollForResults(apiBaseUrl, jobId, loadingIndicator);
    
    // Display the result
    document.getElementById('aiResponse').innerHTML = formatTarotResponse(result);
  } catch (error) {
    document.getElementById('aiResponse').innerHTML = `<div class="error">解读失败: ${error.message}</div>`;
  }
}

async function pollForResults(apiBaseUrl, jobId, loadingIndicator) {
  // Set polling parameters
  const maxAttempts = 30;  // Maximum polling attempts
  const initialDelay = 2000;  // Start with 2 seconds
  const maxDelay = 8000;  // Max delay between polls (8 seconds)
  let currentDelay = initialDelay;
  let attempts = 0;
  
  // Add animation to loading indicator
  const dots = ['', '.', '..', '...'];
  let dotIndex = 0;
  const updateDots = setInterval(() => {
    dotIndex = (dotIndex + 1) % dots.length;
    const baseText = '解读中，请稍候';
    loadingIndicator.textContent = baseText + dots[dotIndex];
  }, 500);

  // Poll for the job status
  while (attempts < maxAttempts) {
    attempts++;
    
    try {
      // Update loading message to show progress
      if (attempts > 1) {
        // Only update the loading text after initial delay
        const baseText = `解读中，请稍候 (${attempts}/${maxAttempts})`;
        loadingIndicator.textContent = baseText + dots[dotIndex];
      }
      
      // Check job status
      const response = await fetch(`${apiBaseUrl}/interpret?jobId=${jobId}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '检查解读任务状态失败');
      }
      
      // Check job status
      if (data.status === 'completed') {
        clearInterval(updateDots);
        return data.result;
      } else if (data.status === 'failed') {
        clearInterval(updateDots);
        throw new Error(data.error || '解读任务失败');
      }
      
      // If still processing, wait and try again
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Increase delay time with each attempt (exponential backoff)
      currentDelay = Math.min(currentDelay * 1.5, maxDelay);
    } catch (error) {
      clearInterval(updateDots);
      throw error;
    }
  }
  
  // If we exit the loop, we've exceeded maximum attempts
  clearInterval(updateDots);
  throw new Error('解读超时，请稍后再试');
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