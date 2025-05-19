document.addEventListener('DOMContentLoaded', () => {
    const carsListElement = document.getElementById('cars');
    const carDetailsSection = document.getElementById('car-details');
    const detailsContentElement = document.getElementById('details-content');
    const backToListButton = document.getElementById('back-to-list');
    const addCarSection = document.getElementById('add-car');
    const addCarForm = document.getElementById('add-car-form');
    const addCarError = document.getElementById('add-car-error');
    const addConsumptionInput = document.getElementById('consumption');
    const addElectricCheckbox = document.getElementById('electric');
    const editCarSection = document.getElementById('edit-car');
    const editCarForm = document.getElementById('edit-car-form');
    const editCarError = document.getElementById('edit-car-error');
    const editConsumptionInput = document.getElementById('edit-consumption');
    const editElectricCheckbox = document.getElementById('edit-electric');
    const cancelEditButton = document.getElementById('cancel-edit');

    const API_URL = `https://iit-playground.arondev.hu/api/F7M6MG/car`;

    function displayError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    function handleConsumptionInputState(electricCheckbox, consumptionInput) {
        consumptionInput.disabled = electricCheckbox.checked;
        if (electricCheckbox.checked) {
            consumptionInput.value = 0;
        }
    }

    async function handleApiResponse(response, contextErrorMessage = 'Hiba történt a művelet során.') {
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP ${response.status} hiba: `;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage += errorJson.message || errorText;
            } catch (e) {
                errorMessage += errorText;
            }
            if (response.status === 404) {
                if (contextErrorMessage.includes("módosításhoz") || contextErrorMessage.includes("törléshez")) {
                    errorMessage = `HTTP 404: Nem található autó a megadott ID-vel. (Részletek: ${errorText})`;
                } else {
                    errorMessage = `HTTP 404: Az erőforrás nem található. (Részletek: ${errorText})`;
                }
            }
            throw new Error(errorMessage);
        }
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return response.json();
        }
        return null; 
    }
    
    function getCarDataFromForm(formElement, isEditMode = false) {
        const formData = new FormData(formElement);
        const isElectric = formData.get('electric') === 'on';
        let consumptionValue = 0;
        const yearFromForm = formData.get('year');
        const owner = formData.get('owner');

        if (!isElectric) {
            const consumptionString = formData.get('consumption');
            if (consumptionString) {
                consumptionValue = parseFloat(consumptionString.replace(',', '.'));
            }
        }
        
        const carData = {
            brand: formData.get('brand'),
            model: formData.get('model'),
            dayOfCommission: yearFromForm ? `${yearFromForm}-01-01` : null,
            fuelUse: consumptionValue,
            electric: isElectric,
            owner: owner
        };

        if (isEditMode) {
            carData.id = parseInt(formData.get('id')); 
        }
        return carData;
    }

    function validateCarData(carData, errorElement, isEditMode = false) {
        const yearFromForm = carData.dayOfCommission ? parseInt(carData.dayOfCommission.substring(0, 4)) : null;
        const currentYear = new Date().getFullYear();

        if (!carData.brand || !carData.model) {
             displayError(errorElement, 'A márka és modell megadása kötelező!'); return false;
        }
        if (yearFromForm === null || isNaN(yearFromForm) || yearFromForm > currentYear || yearFromForm < 1886) {
            displayError(errorElement, 'Adj meg érvényes évjáratot!'); return false;
        }
        if (!carData.owner) {
            displayError(errorElement, 'A tulajdonos megadása kötelező!'); return false;
        }
        if (!carData.electric && (carData.fuelUse === null || isNaN(carData.fuelUse))) {
            displayError(errorElement, 'Nem elektromos autó esetén a fogyasztás megadása kötelező és számnak kell lennie!'); return false;
        }
        if (carData.fuelUse !== null && carData.fuelUse < 0) {
            displayError(errorElement, 'A fogyasztás nem lehet negatív!'); return false;
        }
        return true;
    }

    function updateUIView(activeSectionId) {
        [carsListElement, carDetailsSection, addCarSection, editCarSection].forEach(section => {
            section.classList.add('hidden');
        });

        if (activeSectionId === 'list') {
            carsListElement.classList.remove('hidden');
            addCarSection.classList.remove('hidden'); 
        } else if (activeSectionId === 'details') {
            carDetailsSection.classList.remove('hidden');
        } else if (activeSectionId === 'edit') {
            editCarSection.classList.remove('hidden');
        }
 
    }


    async function loadInitialCars() {
        try {
            const cars = await handleApiResponse(await fetch(API_URL), 'Autók betöltésekor');
            displayCars(cars);
        } catch (error) {
            console.error('Hiba az autók betöltésekor:', error);
            carsListElement.innerHTML = `<li>Hiba történt az autók betöltésekor: ${error.message}</li>`;
        }
    }

    function displayCars(cars) {
        carsListElement.innerHTML = '';
        if (!cars || cars.length === 0) {
            carsListElement.innerHTML = '<li>Nincsenek megjeleníthető autók.</li>';
            return;
        }
        cars.forEach(car => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                ${car.brand || ''} ${car.model || ''} 
                (${(car.dayOfCommission ? new Date(car.dayOfCommission).getFullYear() : '')})
                <div>
                    <button class="view-details" data-id="${car.id}">Részletek</button>
                    <button class="edit-car-btn" data-id="${car.id}">Módosít</button>
                    <button class="delete-car-btn" data-id="${car.id}">Töröl</button>
                </div>`;
            carsListElement.appendChild(listItem);
        });
        addEventListenersToCarButtons();
    }

    async function fetchCarDetails(id) {
        try {
            const car = await handleApiResponse(await fetch(`${API_URL}/${id}`), 'Autó adatainak lekérésekor');
            if (car) displayCarDetails(car);
            updateUIView('details');
        } catch (error) {
            console.error('Hiba az autó adatainak lekérésekor:', error);
            detailsContentElement.innerHTML = `<p>Hiba történt az autó adatainak lekérésekor: ${error.message}</p>`;
            updateUIView('details'); 
        }
    }

    function displayCarDetails(car) {
        let consumptionText = car.electric ? 'Nincs (elektromos)' : 
            (car.fuelUse !== undefined && car.fuelUse !== null ? `${String(car.fuelUse).replace('.', ',')} l/100km` : 'Nincs adat');
        
        detailsContentElement.innerHTML = `
            <p><strong>Márka:</strong> ${car.brand || 'N/A'}</p>
            <p><strong>Modell:</strong> ${car.model || 'N/A'}</p>
            <p><strong>Évjárat:</strong> ${car.dayOfCommission ? new Date(car.dayOfCommission).getFullYear() : 'N/A'}</p>
            <p><strong>Elektromos:</strong> ${car.electric ? 'Igen' : 'Nem'}</p>
            <p><strong>Fogyasztás (l/100km):</strong> ${consumptionText}</p>
            <p><strong>Tulajdonos:</strong> ${car.owner || 'N/A'}</p>
            <p><strong>Üzembe helyezés:</strong> ${car.dayOfCommission ? new Date(car.dayOfCommission).toLocaleDateString() : 'N/A'}</p>`;
    }

    addCarForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        addCarError.classList.add('hidden');
        const carData = getCarDataFromForm(addCarForm);

        if (!validateCarData(carData, addCarError)) return;

        try {
            await handleApiResponse(await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData),
            }), 'Autó hozzáadásakor');
            
            addCarForm.reset();
            handleConsumptionInputState(addElectricCheckbox, addConsumptionInput);
            loadInitialCars();
            alert('Az autó sikeresen hozzáadva!');
            updateUIView('list');
        } catch (error) {
            console.error('Hiba az autó hozzáadásakor:', error);
            displayError(addCarError, error.message);
        }
    });

    async function editCar(id) {
        try {
            const car = await handleApiResponse(await fetch(`${API_URL}/${id}`), 'Szerkesztendő autó adatainak lekérésekor');
            if (!car) return;

            editCarForm.elements['id'].value = car.id; 
            editCarForm.elements['brand'].value = car.brand || '';
            editCarForm.elements['model'].value = car.model || '';
            editCarForm.elements['year'].value = car.dayOfCommission ? new Date(car.dayOfCommission).getFullYear() : '';
            editCarForm.elements['owner'].value = car.owner || '';
            editCarForm.elements['electric'].checked = car.electric;
            editCarForm.elements['consumption'].value = (!car.electric && car.fuelUse !== undefined && car.fuelUse !== null) ? String(car.fuelUse).replace('.', ',') : '';
            
            handleConsumptionInputState(editElectricCheckbox, editConsumptionInput);
            updateUIView('edit');
        } catch (error) {
            console.error('Hiba az autó adatainak szerkesztésre való betöltésekor:', error);
            alert(error.message);
        }
    }

    editCarForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        editCarError.classList.add('hidden');
        const carData = getCarDataFromForm(editCarForm, true); 

        if (!validateCarData(carData, editCarError, true)) return;
        
        try {
            const updatedCar = await handleApiResponse(await fetch(API_URL, { 
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carData),
            }), `Autó (ID: ${carData.id}) módosításakor`);

            editCarForm.reset();
            handleConsumptionInputState(editElectricCheckbox, editConsumptionInput);
            loadInitialCars();
            alert(`Az autó (ID: ${updatedCar ? updatedCar.id : carData.id}) adatai sikeresen módosítva!`);
            updateUIView('list');
        } catch (error) {
            console.error('Hiba az autó módosításakor:', error);
            displayError(editCarError, error.message);
        }
    });

  async function deleteCar(id) {
    const userConfirmed = confirm('Biztosan törölni szeretné ezt az autót?');
    console.log('[deleteCar] Called for ID:', id, '- User confirmed:', userConfirmed); 

    if (userConfirmed) {
        console.log('[deleteCar] Attempting to delete car with ID:', id); 
        try {
            await handleApiResponse(await fetch(`${API_URL}/${id}`, {
                method: 'DELETE',
            }), `Autó (ID: ${id}) törlésekor`);
            
            console.log('[deleteCar] Car deleted successfully from server for ID:', id); 
            loadInitialCars();
            alert('Az autó sikeresen törölve!');
            updateUIView('list');
        } catch (error) {
            console.error(`[deleteCar] Hiba az autó (ID: ${id}) törlésekor:`, error); 
            alert(`Hiba a törlés során: ${error.message}`); 
        }
    } else {
        console.log('[deleteCar] User cancelled deletion for ID:', id);
    }
}

function addEventListenersToCarButtons() {
    carsListElement.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;

        const carId = button.dataset.id;
  
        if (!carId) {
            console.warn('[eventListener] Button clicked without a data-id attribute:', button); 
            return;
        }

        if (button.classList.contains('view-details')) {
            fetchCarDetails(carId);
        } else if (button.classList.contains('edit-car-btn')) {
            editCar(carId);
        } else if (button.classList.contains('delete-car-btn')) {
            console.log('[eventListener] Delete button clicked for ID:', carId); 
            deleteCar(carId);
        }
    });
}
    
    function setupNavigationButtons() {
        backToListButton.addEventListener('click', () => updateUIView('list'));
        cancelEditButton.addEventListener('click', () => {
            editCarForm.reset();
            handleConsumptionInputState(editElectricCheckbox, editConsumptionInput);
            updateUIView('list');
        });
    }

    function initializeApp() {
        addElectricCheckbox.addEventListener('change', () => handleConsumptionInputState(addElectricCheckbox, addConsumptionInput));
        editElectricCheckbox.addEventListener('change', () => handleConsumptionInputState(editElectricCheckbox, editConsumptionInput));
        setupNavigationButtons();
        loadInitialCars();
        updateUIView('list'); 
    }

    initializeApp();
});