let volume = 0.5,
isStarted = false,
isPause = true,
isMuted = false,
q = 50,
hz = 10000,
detune = 2000,
melodies = [];

const context = new (window.AudioContext || window.webkitAudioContext)();

//Create wave with custom form
const sineTerms = new Float32Array([0, 0, 0, 1]);
const cosineTerms = new Float32Array([1, 0, 0, 0]);
const customWaveform = context.createPeriodicWave(cosineTerms, sineTerms);


// Create default melody form and add Events to controls

$(document).ready(() => {
    createMelodyForm();

    $('body').on('click', '#play-btn', handlePlayClick);

    $('#mute-btn').on('click', handleMuteClick);

    $('#volume-range').on('input', handleVolumeChange);

    $('#filter-range').on('input', handleFilterChange);

    $('#detune-range').on('input', handleDetuneChange);

    $('#q-range').on('input', handleQChange);

    $('body').on('click','.remove-form', handleRemoveForm);

    $('#add-btn').on('click', createMelodyForm);    
});

//If not already created, we prepare and check all melodies. Then start play music
function handlePlayClick(e) {
    if(!isStarted) {
        isStarted = true;
        melodies = [];
        $('form').each((idx, form) => {
            const data = Object.fromEntries(new FormData(form).entries());
            const sounds = data.notes.replaceAll(/\r\n/g, ' ').replaceAll(/  /g, ' ').trim().split(' ');
            const bmp = data.bmp;
            const type = data.type;
            const check = validateMelody(sounds);
            if(check.isValid) {
                const noteObjs = sounds.map(sound => {
                    return {  
                        sound: sound,                      
                        frequency: getFrequency(sound),
                        duration: getDuration(sound, bmp)
                    }
                });                

                melodies.push({
                    formId: $(form).attr('id'),
                    bmp: bmp,                    
                    type: type,
                    position: 0,
                    notes: noteObjs
                });
            } else {
                showWarning(form, check.message);
            }
         });
         
         if(melodies.length < 1) {
            isStarted = false;
            return;
         }
    }

    isPause = !isPause;

    if(!isPause) { 
        $('#play-btn').html('<i class="bi bi-stop-circle" style="font-size: 2rem;"></i>');
        melodies.map(melody => {
            if(melody.position < melody.notes.length) {
                switchNote(melody);
            }            
        });
    } else {
        $('#play-btn').html('<i class="bi bi-play" style="font-size: 2rem;"></i>');
    }
}

//Show warning message
function showWarning(form, message) {
    const errorMsgCt = $($(form).find('.invalid-feedback')[0]);
    const errorField = $($(form).find('textarea.form-control')[0]);
    errorMsgCt.text(`* Error: ${message}`);
    errorField.addClass('is-invalid');
    setTimeout(() => {
        errorField.removeClass('is-invalid');
    }, 1500);
}

//Handle Biquad Filter changes
function handleFilterChange(e) {
    hz = e.target.value;
}

//Handle Q parameter changes
function handleQChange(e) {
    q = e.target.value;
}


//Handle Volume changes
function handleVolumeChange(e) {
    volume = e.target.value / 100;
}


//Handle Detune parameter changes
function handleDetuneChange(e) {
    detune = e.target.value;
}


//Handle Mute changes
function handleMuteClick() {
    isMuted = !isMuted;
    if(isMuted) {
        volume = 0.001;
        $('#mute-btn').html('<i class="bi bi-volume-mute" style="font-size: 2rem;"></i>');
    } else {
        volume = parseInt($('#volume-range').val()) / 100;
        $('#mute-btn').html('<i class="bi bi-volume-down" style="font-size: 2rem;"></i>');
    }    
}

//Remove melody form by click
function handleRemoveForm(e) {
    const form = $(e.target).closest('form');
    const id = form.attr('id');
    const idx = melodies.findIndex(m => m.formId === id);
    if(idx) {
        melodies.splice(idx, 1);
    }
    form.remove();
    if($('form').length < 4) {
        $('#add-btn').prop('disabled', false);
    }
}


//Create oscillator for each note and switch them with delay
function switchNote(melody) {   
    const oscillator = context.createOscillator();
    if(melody.type === 'custom') {
        oscillator.setPeriodicWave(customWaveform);
    } else {
        oscillator.type = melody.type;
    }
    
    const note = melody.notes[melody.position];
    oscillator.frequency.value = note.frequency; 
    oscillator.detune.value = detune;

    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.value = hz;

    const endTime = context.currentTime + note.duration/1000
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.005);
        
    oscillator.start();   
    gain.gain.linearRampToValueAtTime(0, endTime - 0.005);
    oscillator.stop(endTime);
                
    setTimeout(() => {  
        melody.position++;
        if(melody.notes[melody.position]) {
            if(!isPause) {
                switchNote(melody);
            }            
        } else {
          checkFinished();  
        }       
    }, note.duration);
}

//If all melodies are finished need to reset positions to start
function checkFinished() {
    let isAllFinished = true;
    melodies.map(melody => {
        if(melody.position < melody.notes.length) {
            isAllFinished = false;
        }
    });

    if(isAllFinished) {
        isPause = true;
        isStarted = false;
        melodies.map(melody => {
            melody.position = 0;
        });
        $('#play-btn').html('<i class="bi bi-play" style="font-size: 2rem;"></i>');
    }
}

//Check melody is valid
function validateMelody(sounds) {
    let result = {
        isValid: true,
        message: ''
    }

    if(sounds && sounds.length > 0) {
        sounds.map(sound => {
            if(!/(_)|(^[A-Z]{1}#?[0-8]{1})\/[0-9]+\.?/.test(sound)) {
                result.isValid = false;
                result.message = `Invalid sound ${sound}. Please check your melody.`;
            }
        });
    } else {
        result.isValid = false;
        result.message = 'Invalid melody data.';
    }

    return result;
}

//Transform string to frequency
function getFrequency(sound) {
    const octaveMap = {
        'C': 32.703195662574829,
        'С#': 34.647828872109012,
        'D': 36.708095989675945,
        'D#': 38.890872965260113,
        'E': 41.203444614108741,
        'F': 43.653528929125485,
        'F#': 46.249302838954299,
        'G': 48.999429497718661,
        'G#': 51.913087197493142,
        'A': 55.000000000000000,
        'A#': 58.270470189761239,
        'B': 61.735412657015513
    }

    const soundData = sound.split('/');
    const noteStr = soundData[0];

    if(noteStr === '_') {
        return null;
    } else {
        const note = noteStr.replaceAll(/\d/g, '');
        const octave = noteStr.replaceAll(/[^\d]/g, '');
    
        return octaveMap[note] * Math.pow(2, octave-1);
    }       
}


//Count note duration
function getDuration(sound, bmp) {
    const timeData = sound.split('/')[1];
    let duration = parseInt(timeData) / 4;
    const matches = timeData.matchAll(/\./g);
    const durationRates = [1, 1.5, 1.75, 1.875];
    let count = 0;
    for (const match of matches) {
        count++;
    }
    
    return (60000 /bmp) * durationRates[count] /  duration;
}

//Add one more Melody Form to player. No more 4 forms
function createMelodyForm() {    
    if($('form').length >= 3) {
        $('#add-btn').prop('disabled', true);
    }
    const timeId = Date.now();
    $('.card-body').append(`<form id="form-${timeId}">
    <div class="input-group mb-3">
      <label class="input-group-text" for="notes-${timeId}">
        <i class="bi bi-music-note-list"></i>
      </label>
      <textarea name="notes" class="form-control" id="notes-${timeId}" placeholder="Notes" rows="7"></textarea>
      <div class="invalid-feedback">
        Please choose a username.
      </div>
    </div>
    <div class="row">
      <div class="input-group mb-3 col-3">
        <label class="input-group-text" for="bmp-${timeId}">
          <i class="bi bi-activity"></i>
        </label>
        <input name="bmp" type="number" step="1" min="50" max="200" value="100" class="form-control" id="bmp-${timeId}" placeholder="BMP"></textarea>
      </div>
      <div class="input-group mb-3 col-8">
        <div class="form-check form-check-inline ">
          <input class="form-check-input" type="radio" name="type" id="sine-radio-${timeId}" value="sine" checked>
          <label class="form-check-label" for="sine-radio-${timeId}">Sine</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="type" id="triangle-radio-${timeId}" value="triangle">
          <label class="form-check-label" for="triangle-radio-${timeId}">Triangle</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="type" id="square-radio-${timeId}" value="square">
          <label class="form-check-label" for="square-radio-${timeId}">Square</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="type" id="sawtooth-radio-${timeId}" value="sawtooth">
          <label class="form-check-label" for="sawtooth-radio-${timeId}">Saw Tooth</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="type" id="custom-radio-${timeId}" value="custom">
          <label class="form-check-label" for="custom-radio-${timeId}">Custom</label>
        </div>
      </div>
      <div class="input-group mb-3 col-1">
        <button class="btn bg-transparent text-white remove-form" type="button" data-bs-toggle="tooltip" data-bs-html="true" title="Remove Melody Form">
            <i class="bi bi-dash-circle"></i>
        </button>
      </div>       
    </div>
  </form>`);
}