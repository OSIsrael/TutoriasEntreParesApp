import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  NavController, IonGrid, IonRow, IonCol, IonSelect, IonSelectOption,IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, mailOutline, businessOutline, schoolOutline,
  bookOutline, logOutOutline, peopleOutline, notificationsOutline, 
  barChartOutline, personOutline, settingsOutline, addCircleOutline,
  closeOutline, checkmarkOutline, warningOutline } from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs, addDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-tutor-estadisticas',
  templateUrl: './tutor-estadisticas.page.html',
  styleUrls: ['./tutor-estadisticas.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule,
    IonButtons, IonButton, IonIcon, IonGrid, IonRow, IonCol,
    IonSelect, IonSelectOption, IonSpinner
  ]
})
export class TutorEstadisticasPage implements OnInit {
  private firestore = inject(DatabaseService).firestore;
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);

  usuario = { nombre: 'CARGANDO...', correo: '', sede: '' };
  rolUsuario: string = '';
  carreraUsuario: string = '';
  cicloUsuario: number = 1;
  celularUsuario: string = '';

  menuAbierto: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  // 🌟 VARIABLES PARA EL DASHBOARD
  totalClasesDadas: number = 0;
  totalAlumnosAtendidos: number = 0;
  
  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;

  // 🌟 VARIABLES PARA INCREMENTO DE MATERIAS
  mostrarModalMaterias: boolean = false;
  cargandoMaterias: boolean = false;
  materiasDisponibles: string[] = [];
  materiasSeleccionadas: string[] = [];
  horariosActualesTutor: any = {};

  constructor() {
    addIcons({notificationsOutline,personCircleOutline,mailOutline,businessOutline,barChartOutline,addCircleOutline,personOutline,logOutOutline,settingsOutline,bookOutline,warningOutline,peopleOutline,schoolOutline,closeOutline,checkmarkOutline});
  }

  ngOnInit() {}

  async ionViewWillEnter() {
    this.menuAbierto = false;
    const correoGuardado = localStorage.getItem('correo');
    
    if (!correoGuardado) {
      this.navCtrl.navigateRoot('/login');
      return;
    }

    this.usuario = {
      nombre: (localStorage.getItem('nombre') || 'SIN NOMBRE').toUpperCase(),
      correo: correoGuardado,
      sede: (localStorage.getItem('sede') || 'CUENCA').toUpperCase()
    };

    this.rolUsuario = localStorage.getItem('rol') || 'TUTOR';
    this.carreraUsuario = (localStorage.getItem('carrera') || '').toUpperCase();
    this.celularUsuario = localStorage.getItem('celular') || '';
    
    const cicloStr = localStorage.getItem('ciclo') || '1';
    this.cicloUsuario = parseInt(cicloStr.replace(/\D/g, ''), 10) || 1;

    await this.verificarNotificaciones(this.usuario.correo, this.rolUsuario, this.usuario.sede);
    
    setTimeout(() => { this.cargarEstadisticas(); }, 300);
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede, 'TUTOR');
      const sinLeer = notifs.filter((n: any) => !n['leida_por']?.includes(correo));
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {}
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones'], { queryParams: { panel: 'TUTOR' } });
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  irAPanelEstudiante() {
    this.router.navigate(['/tabs/perfil']); 
  }

  async cerrarSesion() {
    try {
      await signOut(this.auth);
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    } catch (error) {
      localStorage.clear();
      this.navCtrl.navigateRoot('/login');
    }
  }

  async cargarEstadisticas() {
    try {
      const qClases = query(
        collection(this.firestore, 'Asistencias'), 
        where('correoTutor', '==', this.usuario.correo.toLowerCase())
      );
      const clasesSnap = await getDocs(qClases);
      
      this.totalClasesDadas = clasesSnap.size;
      const alumnosUnicos = new Set();
      const conteoMaterias: { [key: string]: number } = {};

      clasesSnap.forEach(doc => {
        const data = doc.data();
        if (data['estudiante_info']) {
          alumnosUnicos.add(data['estudiante_info']);
        }
        const materia = data['materia'] || 'Otra';
        conteoMaterias[materia] = (conteoMaterias[materia] || 0) + 1;
      });

      this.totalAlumnosAtendidos = alumnosUnicos.size;

      if (Object.keys(conteoMaterias).length > 0) {
        this.generarGrafico(conteoMaterias);
      }
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  }

  generarGrafico(datos: any) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    const labels = Object.keys(datos);
    const data = Object.values(datos);

    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tutorías Impartidas',
          data: data,
          backgroundColor: '#EAB308',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  // ==========================================
  // 🌟 INCREMENTO DE ASIGNATURAS
  // ==========================================
  async abrirModalMaterias() {
    this.menuAbierto = false;
    this.mostrarModalMaterias = true;
    this.cargandoMaterias = true;
    this.materiasSeleccionadas = [];

    try {
      // 1. Buscamos al tutor para saber qué materias YA TIENE y sus horarios
      const qTutor = query(collection(this.firestore, 'Tutores'), where('correo', '==', this.usuario.correo.toLowerCase()));
      const snapTutor = await getDocs(qTutor);
      
      let materiasQueYaTiene: string[] = [];
      if (!snapTutor.empty) {
        const dataTutor = snapTutor.docs[0].data();
        materiasQueYaTiene = (dataTutor['materias'] || []).map((m:string) => m.toUpperCase());
        this.horariosActualesTutor = dataTutor['horarios'] || { "Aviso": "Mantiene horario registrado" };
      }

      // 2. Traemos el catálogo general
      const catalogos = await this.dbService.obtenerCatalogosDesdeExcel();
      
      // 3. Filtramos: Misma Carrera + Ciclo Menor + Que no la tenga ya
      this.materiasDisponibles = catalogos.materias
        .filter(m => 
          m.carrera.toUpperCase() === this.carreraUsuario && 
          m.ciclo < this.cicloUsuario && 
          !materiasQueYaTiene.includes(m.nombre.toUpperCase())
        )
        .map(m => m.nombre.toUpperCase());

    } catch (error) {
      console.error("Error al cargar materias:", error);
    }
    this.cargandoMaterias = false;
  }

  async enviarSolicitudMaterias() {
    if (this.materiasSeleccionadas.length === 0) {
      alert("Selecciona al menos una materia para solicitar.");
      return;
    }

    try {
      this.cargandoMaterias = true;
      const basePayload = {
        correo: this.usuario.correo.toLowerCase(),
        nombre: this.usuario.nombre,
        sede: this.usuario.sede,
        carrera: this.carreraUsuario,
        ciclo: this.cicloUsuario,
        celular: this.celularUsuario,
        permanencia: 'TUTOR ACTIVO (INCREMENTO)',
        disponibilidad_horaria: this.horariosActualesTutor,
        estado_aprobacion: 'PENDIENTE',
        fecha_postulacion: new Date().toISOString()
      };

      // Guardar cada materia como una postulación
      for (let materia of this.materiasSeleccionadas) {
        const payload = { ...basePayload, materia_postulada: materia };
        await addDoc(collection(this.firestore, 'Postulaciones'), payload);
        
        // Notificamos a la administración de su sede
        await this.dbService.crearNotificacion({
          titulo: 'Solicitud de Incremento de Materias',
          mensaje: `${this.usuario.nombre} solicitó impartir ${materia}.`,
          tipo: 'POSTULACION',
          rol_destino: 'ADMIN',
          sede_destino: this.usuario.sede 
        });
      }

      alert("Solicitud enviada correctamente. El administrador la revisará pronto.");
      this.mostrarModalMaterias = false;

    } catch (error) {
      alert("Error al enviar la solicitud.");
    } finally {
      this.cargandoMaterias = false;
    }
  }
}