import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { 
  personCircleOutline, bookOutline, logOutOutline, peopleOutline, 
  settingsOutline, businessOutline, mailOutline, notificationsOutline, 
  personOutline, schoolOutline, analyticsOutline 
} from 'ionicons/icons';
import { Auth, signOut } from '@angular/fire/auth';
import { 
  IonContent, IonHeader, IonToolbar, 
  IonButtons, IonButton, IonIcon,
  NavController 
} from '@ionic/angular/standalone';

import { DatabaseService } from '../../services/database';
import { Firestore, collection, query, where, getDocs } from '@angular/fire/firestore';
import Chart from 'chart.js/auto'; // 🌟 Importación de la librería de gráficas

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonToolbar, CommonModule, FormsModule,
    RouterModule, IonButtons, IonButton, IonIcon, 
  ]
})
export class PerfilPage implements OnInit {
  private router = inject(Router);
  private auth = inject(Auth);
  private navCtrl = inject(NavController); 
  private dbService = inject(DatabaseService); 
  private firestore = inject(Firestore); // 🌟 Para consultar las reservas del estudiante

  esTutor: boolean = false;
  usuario = {
    nombre: 'CARGANDO...',
    correo: '',
    sede: ''
  };
  menuAbierto: boolean = false; 
  rolUsuario: string = '';
  esAdmin: boolean = false;
  hayNotificacionesSinLeer: boolean = false;

  // 🌟 PUNTO 6: VARIABLES DEL DASHBOARD
  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  graficoBarras: any;
  totalTutorias: number = 0;

  constructor() {
    addIcons({
      notificationsOutline, personCircleOutline, mailOutline, businessOutline, 
      bookOutline, settingsOutline, logOutOutline, peopleOutline, personOutline, schoolOutline, analyticsOutline
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

    const nombreGuardado = localStorage.getItem('nombre') || 'SIN NOMBRE';
    let rolGuardado = localStorage.getItem('rol') || 'ESTUDIANTE';
    const sedeGuardada = localStorage.getItem('sede') || 'CUENCA'; 

    // DOBLE VERIFICACIÓN EN TIEMPO REAL
    const rolReal = await this.dbService.obtenerRolUsuario(correoGuardado);
    if (rolReal === 'TUTOR' || rolReal === 'ADMIN' || rolReal === 'COORDINADOR') {
      rolGuardado = rolReal;
      localStorage.setItem('rol', rolReal);
    }
    
    this.usuario = {
      nombre: nombreGuardado.toUpperCase(),
      correo: correoGuardado,
      sede: sedeGuardada.toUpperCase()
    };

    this.rolUsuario = rolGuardado;
    this.esAdmin = (this.rolUsuario === 'ADMIN' || this.rolUsuario === 'COORDINADOR');
    this.esTutor = (rolGuardado === 'TUTOR' || rolGuardado === 'COORDINADOR' || rolGuardado === 'ADMIN');

    await this.verificarNotificaciones(correoGuardado, rolGuardado, sedeGuardada);
    
    // 🌟 PUNTO 6: DISPARAR CARGA DEL DASHBOARD
    setTimeout(() => { this.cargarEstadisticasEstudiante(); }, 500);
  }

  // ==========================================
  // 🌟 LÓGICA DEL DASHBOARD ACADÉMICO
  // ==========================================
  async cargarEstadisticasEstudiante() {
    try {
      // Consultamos cuántas citas ha agendado el estudiante
      const q = query(
        collection(this.firestore, 'Reservas'),
        where('correoEstudiante', '==', this.usuario.correo)
      );
      
      const snapshot = await getDocs(q);
      this.totalTutorias = snapshot.size;

      const conteoMaterias: { [key: string]: number } = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const materia = data['materia'] || 'Otra';
        conteoMaterias[materia] = (conteoMaterias[materia] || 0) + 1;
      });

      const labels = Object.keys(conteoMaterias);
      const data = Object.values(conteoMaterias);

      this.generarGraficoBarras(labels, data);
    } catch (error) {
      console.error("Error cargando estadísticas del estudiante: ", error);
    }
  }

  generarGraficoBarras(labels: string[], data: number[]) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    if (!this.barCanvas || labels.length === 0) return;

    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Tutorías Recibidas',
          data: data,
          backgroundColor: '#003366', // Azul Corporativo GIETAES
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }

  async verificarNotificaciones(correo: string, rol: string, sede: string) {
    try {
      const notifs = await this.dbService.obtenerNotificacionesUsuario(correo, rol, sede);
      const sinLeer = notifs.filter((n: any) => {
        const leidas = n['leida_por'] || [];
        return !leidas.includes(correo);
      });
      this.hayNotificacionesSinLeer = sinLeer.length > 0;
    } catch (error) {
      console.error("Error al verificar notificaciones:", error);
    }
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
  }

  irANotificaciones() {
    this.router.navigate(['/notificaciones']);
  }

  irAPostulacion() {
    this.router.navigate(['/tabs/postulacion']);
  }

  irAPanelTutor() {
    this.router.navigate(['/tabs-tutor/tutorias']);
  }

  irAAdministracion() {
    this.router.navigate(['/admin-postulaciones']);
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
}