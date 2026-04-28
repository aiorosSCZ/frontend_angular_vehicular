import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';

declare var google: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  currentTab: any = 'inicio';
  tallerData = {
    id_taller: 1,
    razon_social: '',
    nit: '',
    direccion: '',
    estado_aprobacion: '',
    foto_nit_url: null as string | null,
    foto_local_url: null as string | null,
    ubicacion_base_latitud: null as number | null,
    ubicacion_base_longitud: null as number | null
  };
  get initials(): string {
    if (!this.tallerData.razon_social) return 'T';
    const words = this.tallerData.razon_social.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  uploading = false;
  uploadSuccess = false;
  nitFile: File | null = null;
  localFile: File | null = null;

  stats = {
    incidentesActivos: 0,
    completadosHoy: 0,
    gananciasHoy: 0
  };

  es_24_7 = false;
  horario_apertura = '08:00';
  horario_cierre = '19:00';

  mecanicos: any[] = [];
  solicitudes: any[] = [];
  mostrarNotificaciones = false;
  trabajos: any[] = [];
  serviciosDisponibles: any[] = [];
  serviciosTodos: any[] = [];
  serviciosSeleccionados: number[] = [];
  serviciosAsociados: any[] = [];
  especialidadesDisponibles: any[] = [];
  tecnicoSeleccionadoParaEsp: any = null;
  tecnicoEspecialidades: any[] = [];

  nuevoMecanico = {
    nombres: '',
    apellidos: '',
    ci_tecnico: '',
    telefono_contacto: '',
    correo: '',
    password: ''
  };

  nuevoServicioId: any = null;
  nuevoServicioPrecio: number = 50.0;
  nuevoServicioTiempo: number = 30;

  perfilEdit = {
    telefono_taller: '',
    cuenta_bancaria: '',
    horario_apertura: '08:00:00',
    horario_cierre: '18:00:00'
  };

  creandoMecanico = false;
  mecanicoError = '';
  mecanicoSuccess = false;

  constructor(private wsService: WebsocketService, private router: Router, private cdr: ChangeDetectorRef) { }

  map: any;
  technicianMarkers: any[] = [];

  ngAfterViewInit() {
    this.initMap();
    this.startDynamicPolling();
  }

  pollingInterval: any;

  startDynamicPolling() {
    this.pollingInterval = setInterval(() => {
      this.loadMecanicos();
    }, 10000);
  }

  initMap() {
    setTimeout(() => {
      const mapElement = document.getElementById('map');
      if (!mapElement) return;

      const defaultSantaCruz = { lat: -17.7833, lng: -63.1821 };
      const workshopCoords = {
        lat: this.tallerData.ubicacion_base_latitud || defaultSantaCruz.lat,
        lng: this.tallerData.ubicacion_base_longitud || defaultSantaCruz.lng
      };

      try {
        this.map = new google.maps.Map(mapElement, {
          center: workshopCoords,
          zoom: 13,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1e293b' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] }
          ]
        });

        new google.maps.Marker({
          position: workshopCoords,
          map: this.map,
          title: this.tallerData.razon_social || 'Mi Taller',
          icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
        });
      } catch (e) {
        console.error('Error cargando Google Maps:', e);
      }
    }, 1000);
  }

  async ngOnInit() {
    const savedUserId = localStorage.getItem('user_id');
    const savedUserName = localStorage.getItem('user_name');
    if (!savedUserId) {
      this.router.navigate(['/login']);
      return;
    } else {
      this.tallerData.id_taller = parseInt(savedUserId, 10);
      if (savedUserName) {
        this.tallerData.razon_social = savedUserName;
      }
      const savedNit = localStorage.getItem('user_nit');
      if (savedNit) {
        this.tallerData.nit = savedNit;
      }
      const savedDireccion = localStorage.getItem('user_direccion');
      if (savedDireccion) {
        this.tallerData.direccion = savedDireccion;
      }
      await this.fetchTallerInfo(this.tallerData.id_taller);
    }

    this.loadSolicitudes();
    this.loadMecanicos();
    this.wsService.connect(this.tallerData.id_taller);
    await this.loadServicios();
    this.wsService.emergency$.subscribe((alerta) => {
      this.procesarAlerta(alerta);
    });
    this.initMap();
  }

  async fetchTallerInfo(idTaller: number) {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${idTaller}`);
      if (response.ok) {
        const data = await response.json();
        this.tallerData.razon_social = data.razon_social;
        this.tallerData.nit = data.nit;
        this.tallerData.direccion = data.direccion_fisica || this.tallerData.direccion;
        this.tallerData.estado_aprobacion = data.estado_aprobacion;
        this.tallerData.ubicacion_base_latitud = data.ubicacion_base_latitud;
        this.tallerData.ubicacion_base_longitud = data.ubicacion_base_longitud;

        // Cargar edición de perfil
        this.perfilEdit.telefono_taller = data.telefono_taller || '';
        this.perfilEdit.cuenta_bancaria = data.cuenta_bancaria || '';
        this.perfilEdit.horario_apertura = data.horario_apertura || '08:00:00';
        this.perfilEdit.horario_cierre = data.horario_cierre || '18:00:00';

        this.cdr.detectChanges();
      }
    } catch (e) {
      console.error('Error fetching taller info:', e);
    }
  }

  changeTab(tab: string) {
    this.currentTab = tab;
    if (tab === 'servicios') {
      this.loadServiciosDisponibles();
      this.loadTallerServicios();
    } else if (tab === 'habilidades') {
      this.loadEspecialidadesDisponibles();
      this.loadMecanicos();
    }
  }

  ngOnDestroy() {
    this.wsService.disconnect();
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  procesarAlerta(alerta: any) {
    const baseUrl = `https://backend-fastapi-su7t.onrender.com`;
    this.solicitudes.unshift({
      id_incidente: alerta.id_incidente,
      tipo_problema: alerta.problema,
      nivel_prioridad: alerta.prioridad,
      distancia_km: alerta.distancia_km,
      cliente: alerta.cliente || 'Conductor en Ruta',
      vehiculo: alerta.vehiculo || 'Vehículo asignado',
      transcripcion_audio: alerta.transcripcion_audio,
      url_audio_evidencia: alerta.url_audio_evidencia ? `${baseUrl}/${alerta.url_audio_evidencia}` : null,
      url_foto_evidencia: alerta.url_foto_evidencia ? `${baseUrl}/${alerta.url_foto_evidencia}` : null,
      evaluacion_ia: alerta.evaluacion_ia
    });
    this.stats.incidentesActivos = this.solicitudes.length;

    try {
      const audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('AudioContext falló:', e);
    }

    if (this.map && alerta.latitud && alerta.longitud) {
      try {
        new google.maps.Marker({
          position: { lat: alerta.latitud, lng: alerta.longitud },
          map: this.map,
          title: `🚨 Emergencia: ${alerta.problema}`,
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
      } catch (e) {
        console.error('Error dibujando marcador de emergencia:', e);
      }
    }
  }

  toggleNotificaciones() {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
  }

  async guardarHorario() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/horario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          es_24_7: this.es_24_7,
          horario_apertura: this.horario_apertura,
          horario_cierre: this.horario_cierre
        })
      });

      if (response.ok) {
        alert('¡Horario operativo actualizado!');
      } else {
        alert('Error al actualizar el horario.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión.');
    }
  }

  async loadServicios() {
    try {
      const resTodos = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/servicios/todos`);
      if (resTodos.ok) {
        this.serviciosTodos = await resTodos.json();
      }

      const resSel = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/servicios`);
      if (resSel.ok) {
        this.serviciosSeleccionados = await resSel.json();
      }

      const resTaller = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}`);
      if (resTaller.ok) {
        const tData = await resTaller.json();
        this.es_24_7 = tData.es_24_7 || false;
        if (tData.horario_apertura) this.horario_apertura = tData.horario_apertura.substring(0, 5);
        if (tData.horario_cierre) this.horario_cierre = tData.horario_cierre.substring(0, 5);
      }
    } catch (e) {
      console.error('Error cargando servicios y horarios:', e);
    }
  }

  toggleServicio(id: number) {
    if (this.serviciosSeleccionados.includes(id)) {
      this.serviciosSeleccionados = this.serviciosSeleccionados.filter(sid => sid !== id);
    } else {
      this.serviciosSeleccionados.push(id);
    }
  }

  async guardarServicios() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/servicios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ servicios_ids: this.serviciosSeleccionados })
      });

      if (response.ok) {
        alert('¡Servicios actualizados con éxito!');
      } else {
        alert('Error al actualizar los servicios.');
      }
    } catch (e) {
      console.error(e);
      alert('Error de red.');
    }
  }

  async loadSolicitudes() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/solicitudes`);
      if (response.ok) {
        this.solicitudes = await response.json();
        this.stats.incidentesActivos = this.solicitudes.length;
      }
    } catch (error) {
      console.error("Error cargando solicitudes:", error);
    }
  }

  async loadTrabajos() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/trabajos`);
      if (response.ok) {
        this.trabajos = await response.json();
        const completados = this.trabajos.filter(t => t.estado === 'Atendido' || t.estado === 'Completado');
        this.stats.gananciasHoy = completados.reduce((total, t) => total + (t.monto || 0), 0);
      }
    } catch (error) {
      console.error("Error cargando trabajos:", error);
    }
  }

  async loadMecanicos() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/tecnicos`);
      if (response.ok) {
        this.mecanicos = await response.json();

        // Limpiar marcadores previos de técnicos
        this.technicianMarkers.forEach((marker: any) => marker.setMap(null));
        this.technicianMarkers = [];

        // Graficar Técnicos
        this.mecanicos.forEach(m => {
          if (this.map && m.ubicacion_actual_latitud && m.ubicacion_actual_longitud) {
            try {
              const marker = new google.maps.Marker({
                position: { lat: m.ubicacion_actual_latitud, lng: m.ubicacion_actual_longitud },
                map: this.map,
                title: `🔧 Técnico: ${m.nombres} ${m.apellidos}`,
                icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
              });
              this.technicianMarkers.push(marker);
            } catch (e) {
              console.error('Error cargando técnicos en el mapa:', e);
            }
          }
        });
      }
    } catch (error) {
      console.error("Error cargando mecánicos:", error);
    }
  }

  async registrarMecanico() {
    this.mecanicoError = '';
    this.mecanicoSuccess = false;

    if (!this.nuevoMecanico.nombres || !this.nuevoMecanico.nombres.trim()) {
      this.mecanicoError = 'Debes ingresar el nombre del técnico.';
      return;
    }
    if (!this.nuevoMecanico.apellidos || !this.nuevoMecanico.apellidos.trim()) {
      this.mecanicoError = 'Debes ingresar el apellido del técnico.';
      return;
    }

    this.creandoMecanico = true;

    try {
      // Generación automática del correo corporativo
      const nombreLimpio = this.nuevoMecanico.nombres.toLowerCase().trim().replace(/\s+/g, '');
      const apellidoPaterno = this.nuevoMecanico.apellidos.toLowerCase().trim().split(/\s+/)[0];

      let siglasTaller = 't';
      if (this.tallerData.razon_social) {
        const words = this.tallerData.razon_social.trim().split(/\s+/);
        if (words.length === 1) {
          siglasTaller = words[0].substring(0, 2).toLowerCase();
        } else {
          siglasTaller = (words[0][0] + words[1][0]).toLowerCase();
        }
      }

      this.nuevoMecanico.correo = `${nombreLimpio}${apellidoPaterno}_${siglasTaller}@asiscar.com`;

      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/tecnicos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...this.nuevoMecanico,
          id_taller: this.tallerData.id_taller
        })
      });

      const data = await response.json();
      if (response.ok) {
        this.mecanicoSuccess = true;
        this.nuevoMecanico = { nombres: '', apellidos: '', ci_tecnico: '', telefono_contacto: '', correo: '', password: '' };
        this.loadMecanicos();
      } else {
        this.mecanicoError = data.detail || 'Error al registrar mecánico';
      }
    } catch (error) {
      this.mecanicoError = 'Error de conexión con el servidor';
    } finally {
      this.creandoMecanico = false;
    }
  }

  // Función exclusiva para desarrollo: permite cambiar de vista rápidamente
  toggleEstado() {
    this.tallerData.estado_aprobacion = this.tallerData.estado_aprobacion === 'Pendiente' ? 'Aprobado' : 'Pendiente';
  }

  onFileSelected(event: any, tipo: 'nit' | 'local') {
    const file = event.target.files[0];
    if (file) {
      if (tipo === 'nit') this.nitFile = file;
      if (tipo === 'local') this.localFile = file;
    }
  }

  async uploadDocumentos() {
    if (!this.nitFile && !this.localFile) return;

    this.uploading = true;
    const formData = new FormData();
    if (this.nitFile) formData.append('foto_nit', this.nitFile);
    if (this.localFile) formData.append('foto_local', this.localFile);

    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/upload-docs`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        this.uploadSuccess = true;
        this.tallerData.foto_nit_url = data.foto_nit_url;
        this.tallerData.foto_local_url = data.foto_local_url;
        alert('✅ ¡Documentos subidos con éxito!');
      } else {
        alert('❌ No se pudieron subir los documentos: ' + (data.detail || 'Intente nuevamente.'));
      }
    } catch (error) {
      console.error("Error subiendo documentos:", error);
      alert('❌ Error de conexión al subir documentos.');
    } finally {
      this.uploading = false;
    }
  }

  async resetPassword(mec: any) {
    const newPass = window.prompt(`Ingresa la nueva contraseña temporal para ${mec.nombres}:`);
    if (!newPass || newPass.trim().length < 6) {
      if (newPass !== null) alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/tecnicos/${mec.id_tecnico}/resetear-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPass })
      });

      if (response.ok) {
        alert('Contraseña reseteada con éxito. El técnico deberá cambiarla en la app móvil.');
      } else {
        alert('Error al resetear la contraseña.');
      }
    } catch (error) {
      console.error(error);
      alert('Error de conexión.');
    }
  }

  async aceptarServicio(solicitud: any) {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/incidentes/${solicitud.id_incidente}/aceptar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_taller: this.tallerData.id_taller,
          id_tecnico: solicitud.id_tecnico_seleccionado
        })
      });

      if (response.ok) {
        this.solicitudes = this.solicitudes.filter(s => s.id_incidente !== solicitud.id_incidente);
        this.stats.incidentesActivos = this.solicitudes.length;
        this.stats.completadosHoy += 1;
        alert('¡Servicio tomado exitosamente!');
      } else {
        alert('Error al tomar el servicio.');
      }
    } catch (e) {
      console.error('Error tomando el servicio:', e);
    }
  }

  async loadServiciosDisponibles() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/servicios/todos`);
      if (response.ok) this.serviciosDisponibles = await response.json();
    } catch (e) { console.error(e); }
  }

  async loadTallerServicios() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/servicios`);
      if (response.ok) this.serviciosAsociados = await response.json();
    } catch (e) { console.error(e); }
  }

  async vincularServicio() {
    if (!this.nuevoServicioId) return;
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}/servicios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_servicio: Number(this.nuevoServicioId),
          precio: this.nuevoServicioPrecio,
          tiempo: this.nuevoServicioTiempo
        })
      });
      if (response.ok) {
        alert('✅ Servicio vinculado al taller.');
        this.loadTallerServicios();
      }
    } catch (e) { console.error(e); }
  }

  async loadEspecialidadesDisponibles() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/especialidades-disponibles`);
      if (response.ok) this.especialidadesDisponibles = await response.json();
    } catch (e) { console.error(e); }
  }

  async seleccionarTecnicoParaEsp(mec: any) {
    this.tecnicoSeleccionadoParaEsp = mec;
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/tecnicos/${mec.id_tecnico}/especialidades`);
      if (response.ok) this.tecnicoEspecialidades = await response.json();
    } catch (e) { console.error(e); }
  }

  async vincularEspecialidad(idEsp: number) {
    if (!this.tecnicoSeleccionadoParaEsp) return;
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/tecnicos/${this.tecnicoSeleccionadoParaEsp.id_tecnico}/especialidades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_especialidad: Number(idEsp) })
      });
      if (response.ok) {
        alert('✅ Habilidad vinculada al técnico.');
        this.seleccionarTecnicoParaEsp(this.tecnicoSeleccionadoParaEsp);
      }
    } catch (e) { console.error(e); }
  }

  async guardarPerfil() {
    try {
      const response = await fetch(`https://backend-fastapi-su7t.onrender.com/api/talleres/${this.tallerData.id_taller}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.perfilEdit)
      });
      if (response.ok) {
        alert('✅ Perfil del taller guardado.');
      }
    } catch (e) { console.error(e); }
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/login']);
  }
}
