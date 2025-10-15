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
    }, 5000);
  }

  // Сохранение вкладок с группами и состоянием
  saveButton.addEventListener('click', async function() {
    try {
      // Получаем все вкладки и группы
      const [tabs, groups] = await Promise.all([
        chrome.tabs.query({ currentWindow: true }),
        chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT })
      ]);
      
      // Подготавливаем данные для сохранения
      const saveData = {
        timestamp: new Date().toISOString(),
        tabs: tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          pinned: tab.pinned,
          groupId: tab.groupId,
          index: tab.index
        })),
        groups: groups.map(group => ({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed
        })),
        metadata: {
          totalTabs: tabs.length,
          pinnedTabs: tabs.filter(tab => tab.pinned).length,
          groupsCount: groups.length
        }
      };
      
      // Создаем Blob и скачиваем файл
      const blob = new Blob([JSON.stringify(saveData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: `saved_tabs_${Date.now()}.json`,
        saveAs: true
      });
      
      showStatus(
        `Сохранено: ${tabs.length} вкладок, ${groups.length} групп, ${saveData.metadata.pinnedTabs} закрепленных`, 
        true
      );
      
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
        const saveData = JSON.parse(e.target.result);
        restoreTabsFromData(saveData);
      } catch (error) {
        console.error('Ошибка при чтении файла:', error);
        showStatus('Ошибка: Неверный формат файла', false);
      }
    };
    
    reader.onerror = function() {
      showStatus('Ошибка при чтении файла', false);
    };
    
    reader.readAsText(file);
    
    // Сбрасываем input для возможности выбора того же файла снова
    fileInput.value = '';
  });

  // Функция восстановления вкладок из данных
  async function restoreTabsFromData(saveData) {
    try {
      if (!saveData.tabs || !Array.isArray(saveData.tabs)) {
        throw new Error('Неверный формат данных');
      }

      const createdTabs = [];
      const groupMap = new Map(); // Для связи старых и новых ID групп

      // Сначала создаем все вкладки
      for (const tabData of saveData.tabs) {
        try {
          const tab = await chrome.tabs.create({
            url: tabData.url,
            active: false,
            pinned: tabData.pinned
          });
          
          createdTabs.push({
            id: tab.id,
            originalData: tabData
          });
          
          // Сохраняем связь старого groupId с новой вкладкой
          if (tabData.groupId !== -1) {
            if (!groupMap.has(tabData.groupId)) {
              groupMap.set(tabData.groupId, []);
            }
            groupMap.get(tabData.groupId).push(tab.id);
          }
          
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`Ошибка при создании вкладки для ${tabData.url}:`, error);
        }
      }

      // Затем создаем группы и добавляем в них вкладки
      if (saveData.groups && Array.isArray(saveData.groups)) {
        for (const groupData of saveData.groups) {
          const tabIds = groupMap.get(groupData.id);
          if (tabIds && tabIds.length > 0) {
            try {
              const groupId = await chrome.tabs.group({
                tabIds: tabIds,
                createProperties: {
                  windowId: chrome.windows.WINDOW_ID_CURRENT
                }
              });
              
              // Устанавливаем свойства группы
              await chrome.tabGroups.update(groupId, {
                title: groupData.title,
                color: groupData.color,
                collapsed: groupData.collapsed
              });
              
            } catch (error) {
              console.error('Ошибка при создании группы:', error);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      showStatus(
        `Восстановлено: ${createdTabs.length} вкладок, ${groupMap.size} групп`, 
        true
      );
      
    } catch (error) {
      console.error('Ошибка при восстановлении вкладок:', error);
      showStatus('Ошибка при восстановлении вкладок: ' + error.message, false);
    }
  }
});