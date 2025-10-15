document.addEventListener('DOMContentLoaded', function() {
  const saveButton = document.getElementById('saveTabs');
  const restoreButton = document.getElementById('restoreTabs');
  const fileInput = document.getElementById('fileInput');
  const statusDiv = document.getElementById('status');

  // Функция для показа статуса
  function showStatus(message, isSuccess) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + (isSuccess ? 'success' : 'error');
    statusDiv.style.display = 'block';
    
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  // Сохранение вкладок
  saveButton.addEventListener('click', async function() {
    try {
      // Получаем все вкладки текущего окна
      const tabs = await chrome.tabs.query({ currentWindow: true });
      
      // Формируем содержимое файла
      let fileContent = `Сохраненные вкладки (${new Date().toLocaleString()}):\n\n`;
      
      tabs.forEach((tab, index) => {
        fileContent += `${index + 1}. ${tab.title}\n${tab.url}\n\n`;
      });
      
      // Создаем Blob и скачиваем файл
      const blob = new Blob([fileContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: `saved_tabs_${Date.now()}.txt`,
        saveAs: true
      });
      
      showStatus(`Сохранено ${tabs.length} вкладок`, true);
      
      // Освобождаем URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
    } catch (error) {
      console.error('Ошибка при сохранении вкладок:', error);
      showStatus('Ошибка при сохранении вкладок', false);
    }
  });

  // Восстановление вкладок
  restoreButton.addEventListener('click', function() {
    fileInput.click();
  });

  // Обработка выбора файла
  fileInput.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const content = e.target.result;
        restoreTabsFromContent(content);
      } catch (error) {
        console.error('Ошибка при чтении файла:', error);
        showStatus('Ошибка при чтении файла', false);
      }
    };
    
    reader.onerror = function() {
      showStatus('Ошибка при чтении файла', false);
    };
    
    reader.readAsText(file);
    
    // Сбрасываем input для возможности выбора того же файла снова
    fileInput.value = '';
  });

  // Функция восстановления вкладок из содержимого файла
  async function restoreTabsFromContent(content) {
    try {
      const lines = content.split('\n');
      const urls = [];
      
      // Ищем URL в содержимом файла
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Проверяем, является ли строка URL
        if (trimmedLine.startsWith('http://') || 
            trimmedLine.startsWith('https://') ||
            trimmedLine.startsWith('ftp://') ||
            trimmedLine.startsWith('file://')) {
          urls.push(trimmedLine);
        }
      }
      
      if (urls.length === 0) {
        showStatus('В файле не найдено URL для восстановления', false);
        return;
      }
      
      // Создаем новые вкладки для каждого URL
      let createdCount = 0;
      for (const url of urls) {
        try {
          await chrome.tabs.create({ url: url, active: false });
          createdCount++;
          
          // Небольшая задержка чтобы не перегружать браузер
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Ошибка при создании вкладки для ${url}:`, error);
        }
      }
      
      showStatus(`Восстановлено ${createdCount} вкладок`, true);
      
    } catch (error) {
      console.error('Ошибка при восстановлении вкладок:', error);
      showStatus('Ошибка при восстановлении вкладок', false);
    }
  }
});