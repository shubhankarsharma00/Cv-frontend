/* eslint-disable import/no-cycle */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
import * as metadata from './metadata.json';
import { generateId, showMessage } from './utils';
import backgroundArea from './backgroundArea';
import plotArea from './plotArea';
import simulationArea from './simulationArea';
import { dots } from './canvasApi';
import { update, updateSimulationSet, updateCanvasSet } from './engine';
import { setupUI } from './ux';
import startMainListeners from './listeners';
import startEmbedListeners from './embedListeners';
import './embed';
import { newCircuit } from './circuit';
import load from './data/load';
import save from './data/save';

window.width = undefined;
window.height = undefined;
window.DPR = 1; // devicePixelRatio, 2 for retina displays, 1 for low resolution displays

/**
 * to resize window and setup things it
 * sets up new width for the canvas variables.
 * Also redraws the grid.
 * @category setup
 */
export function resetup() {
    DPR = window.devicePixelRatio || 1;
    if (lightMode) { DPR = 1; }
    width = document.getElementById('simulationArea').clientWidth * DPR;
    if (!embed) {
        height = (document.getElementById('simulation').clientHeight - document.getElementById('toolbar').clientHeight) * DPR;
    } else {
        height = (document.getElementById('simulation').clientHeight) * DPR;
    }
    // setup simulationArea and backgroundArea variables used to make changes to canvas.
    backgroundArea.setup();
    if (!embed) plotArea.setup();
    simulationArea.setup();
    // redraw grid
    dots();
    document.getElementById('backgroundArea').style.height = height / DPR + 100;
    document.getElementById('backgroundArea').style.width = width / DPR + 100;
    document.getElementById('canvasArea').style.height = height / DPR;
    simulationArea.canvas.width = width;
    simulationArea.canvas.height = height;
    backgroundArea.canvas.width = width + 100 * DPR;
    backgroundArea.canvas.height = height + 100 * DPR;
    if (!embed) {
        plotArea.c.width = document.getElementById('plot').clientWidth;
        plotArea.c.height = document.getElementById('plot').clientHeight;
    }
    updateCanvasSet(true);
    update(); // INEFFICIENT, needs to be deprecated
    simulationArea.prevScale = 0;
    dots();
}

window.onresize = resetup; // listener
window.onorientationchange = resetup; // listener

// for mobiles
window.addEventListener('orientationchange', resetup); // listener

/**
 * function to setup environment variables like projectId and DPR
 * @category setup
 */
function setupEnvironment() {
    projectId = generateId();
    updateSimulationSet(true);
    const DPR = window.devicePixelRatio || 1;
    newCircuit('Main');
    window.data = {};
    resetup();
}

/**
 * It initializes some useful array which are helpful
 * while simulating, saving and loading project.
 * It also draws icons in the sidebar
 * @category setup
 */
function setupElementLists() {
    $('#menu').empty();

    window.circuitElementList = metadata.circuitElementList;
    window.annotationList = metadata.annotationList;
    window.inputList = metadata.inputList;
    window.subCircuitInputList = metadata.subCircuitInputList;
    window.moduleList = [...circuitElementList, ...annotationList];
    window.updateOrder = ['wires', ...circuitElementList, 'nodes', ...annotationList]; // Order of update
    window.renderOrder = [...(moduleList.slice().reverse()), 'wires', 'allNodes']; // Order of render


    function createIcon(element) {
        return `<div class="icon logixModules" id="${element}" >
            <img src= "./img/${element}.svg" >
            <p class="img__description">${element}</p>
        </div>`;
    }

    window.elementHierarchy = metadata.elementHierarchy;
    for (const category in elementHierarchy) {
        let htmlIcons = '';

        const categoryData = elementHierarchy[category];

        for (let i = 0; i < categoryData.length; i++) {
            const element = categoryData[i];
            htmlIcons += createIcon(element);
        }

        const accordionData = `<div class="panelHeader">${category}</div>
            <div class="panel" style="overflow-y:hidden">
              ${htmlIcons}
            </div>`;

        $('#menu').append(accordionData);
    }
}

/**
 * The first function to be called to setup the whole simulator
 * @category setup
 */
export function setup() {
    const startListeners = embed ? startEmbedListeners : startMainListeners;
    setupElementLists();
    setupEnvironment();
    if (!embed) { setupUI(); }
    startListeners();

    // Load project data after 1 second - needs to be improved, delay needs to be eliminated
    setTimeout(() => {
        if (logix_project_id !== 0) {
            $('.loadingIcon').fadeIn();
            $.ajax({
                url: '/simulator/get_data',
                type: 'POST',
                beforeSend(xhr) {
                    xhr.setRequestHeader('X-CSRF-Token', $('meta[name="csrf-token"]').attr('content'));
                },
                data: {
                    id: logix_project_id,
                },
                success(response) {
                    const data = (response);
                    if (data) {
                        load(data);
                        simulationArea.changeClockTime(data.timePeriod || 500);
                    }
                    $('.loadingIcon').fadeOut();
                },
                failure() {
                    alert('Error: could not load ');
                    $('.loadingIcon').fadeOut();
                },
            });
        } else if (localStorage.getItem('recover_login') && userSignedIn) {
            // Restore unsaved data and save
            const data = JSON.parse(localStorage.getItem('recover_login'));
            load(data);
            localStorage.removeItem('recover');
            localStorage.removeItem('recover_login');
            save();
        } else if (localStorage.getItem('recover')) {
            // Restore unsaved data which didn't get saved due to error
            showMessage("We have detected that you did not save your last work. Don't worry we have recovered them. Access them using Project->Recover");
        }
    }, 1000);
}
