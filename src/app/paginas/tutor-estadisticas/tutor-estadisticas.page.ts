import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { 
  IonContent, IonHeader, IonToolbar, IonIcon, IonButton, IonButtons,
  NavController, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, mailOutline, businessOutline, schoolOutline,
  bookOutline, logOutOutline, peopleOutline, notificationsOutline, 
  barChartOutline, personOutline, settingsOutline
} from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import Chart from 'chart.js/auto'; // 🌟 Importación para la gráfica

@Component({
  selector: 'app-tutor-estadisticas',
  templateUrl: './tutor-estadisticas.page.html',
  styleUrls: ['./tutor-estadisticas.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, 
    IonButtons, IonButton, IonIcon, IonGrid, IonRow, IonCol
  ]
})
export class TutorEstadisticasPage implements OnInit {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController);

  usuario = {
    nombre: 'CARGANDO...',
    correo: '',
    sede: ''
  };

  rolUsuario: string = '';
  menuAbierto: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  // 🌟 VARIABLES PARA EL DASHBOARD
  totalClasesDadas: number = 0;
  totalAlumnosAtendidos: number = 0;
  
  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;

  constructor() {
    addIcons({
      personCircleOutline, mailOutline, businessOutline, settingsOutline,
      logOutOutline, peopleOutline, bookOutline, notificationsOutline, 
      barChartOutline, personOutline, schoolOutline
    });
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

    await this.verificarNotificaciones(this.usuario.correo, this.rolUsuario, this.usuario.sede);
    
    // 🌟 Cargamos el Dashboard
    setTimeout(() => {
      this.cargarEstadisticas();
    }, 300);
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

  // 🌟 EL BOTÓN QUE DEVUELVE AL PANEL DE ESTUDIANTE
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

  // ==========================================
  // 🌟 MOTOR DEL DASHBOARD DEL TUTOR
  // ==========================================
  async cargarEstadisticas() {
    try {
      // Buscamos todas las clases FINALIZADAS que dio este tutor
      const qClases = query(
        collection(this.firestore, 'Reservas'), 
        where('correoTutor', '==', this.usuario.correo.toLowerCase()), 
        where('estado', '==', 'FINALIZADA')
      );
      const clasesSnap = await getDocs(qClases);
      
      this.totalClasesDadas = clasesSnap.size;
      
      const alumnosUnicos = new Set();
      const conteoMaterias: { [key: string]: number } = {};

      clasesSnap.forEach(doc => {
        const data = doc.data();
        // Contamos alumnos únicos
        alumnosUnicos.add(data['correoEstudiante']);
        // Agrupamos por materia para la gráfica
        const materia = data['materia'] || 'Otra';
        conteoMaterias[materia] = (conteoMaterias[materia] || 0) + 1;
      });

      this.totalAlumnosAtendidos = alumnosUnicos.size;

      // Generamos la gráfica si hay datos
      if (Object.keys(conteoMaterias).length > 0) {
        this.generarGrafico(conteoMaterias);
      }

    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
    }
  }

  generarGrafico(datos: any) {
    if (this.graficoBarras) {
      this.graficoBarras.destroy();
    }

    const labels = Object.keys(datos);
    const data = Object.values(datos);

    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tutorías Impartidas',
          data: data,
          backgroundColor: '#EAB308', // Dorado GIETAES
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }
}