import { Component, inject, ElementRef, ViewChild } from '@angular/core';
import { Firestore, collection, query, where, getDocs, addDoc } from '@angular/fire/firestore';
import { DatabaseService } from '../../services/database';
import { CommonModule, KeyValuePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonButton, IonButtons, IonIcon,
  IonItem, IonLabel, IonInput, IonTextarea, IonSelect, IonSelectOption,
  IonDatetime, IonDatetimeButton, IonModal // 🌟 NUEVAS IMPORTACIONES PARA EL CALENDARIO
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBackOutline, megaphoneOutline, checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-admin-postulaciones',
  templateUrl: './admin-postulaciones.page.html',
  styleUrls: ['./admin.postulaciones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar, IonButton,
    KeyValuePipe, IonButtons, IonIcon, IonItem, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption,
    IonDatetime, IonDatetimeButton, IonModal // 🌟 AGREGADOS AL COMPONENTE
  ],
})
export class AdminPostulacionesPage {
  private firestore = inject(Firestore);
  private dbService = inject(DatabaseService);
  private router = inject(Router);

  postulaciones: any[] = [];
  sedeAdmin: string = ''; 

  filtroSedePostulaciones: string = 'GLOBAL';
  filtroSedeGraficas: string = 'GLOBAL'; 

  @ViewChild('barCanvas', { static: false }) private barCanvas!: ElementRef;
  @ViewChild('pieCanvas', { static: false }) private pieCanvas!: ElementRef;
  graficoBarras: any;
  graficoPastel: any;

  nuevoAnuncio = {
    titulo: '',
    descripcion: '',
    fecha_evento: new Date().toISOString(), // 🌟 Inicializamos con la fecha actual
    sede_destino: 'GLOBAL',
  };

  constructor() {
    addIcons({ arrowBackOutline, megaphoneOutline, checkmarkCircleOutline, closeCircleOutline });
  }

  async ionViewWillEnter() {
    const rolActual = localStorage.getItem('rol') || '';
    this.sedeAdmin = (localStorage.getItem('sede') || 'CUENCA').toUpperCase();

    if (rolActual !== 'ADMIN' && rolActual !== 'COORDINADOR') {
      this.router.navigate(['/login']);
      return;
    }

    await this.cargarPostulaciones();
    setTimeout(() => { this.cargarEstadisticas(); }, 500);
  }

  async cargarPostulaciones() {
    try {
      let q;
      if (this.filtroSedePostulaciones === 'GLOBAL') {
        q = query(
          collection(this.firestore, 'Postulaciones'),
          where('estado_aprobacion', '==', 'PENDIENTE')
        );
      } else {
        q = query(
          collection(this.firestore, 'Postulaciones'),
          where('estado_aprobacion', '==', 'PENDIENTE'),
          where('sede', '==', this.filtroSedePostulaciones)
        );
      }
      
      const snapshot = await getDocs(q);
      this.postulaciones = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error cargando postulaciones:', error);
    }
  }

  async aceptar(post: any) {
    try {
      await this.dbService.aceptarTutor(post.id, post);
      alert(`✅ Tutor aceptado en ${post.materia_postulada}`);
      await this.cargarPostulaciones();
      this.cargarEstadisticas();
    } catch (e) { 
      alert('Error al aceptar tutor'); 
    }
  }

  async rechazar(post: any) {
    const confirmar = confirm(`¿Estás seguro de RECHAZAR a ${post.nombre} para dictar ${post.materia_postulada}?`);
    if (!confirmar) return;

    try {
      await this.dbService.rechazarPostulacion(post.id);
      alert(`❌ Postulación para ${post.materia_postulada} rechazada.`);
      await this.cargarPostulaciones(); 
    } catch (error) {
      alert('Error al rechazar la postulación.');
    }
  }

  obtenerDia(clave: any): string { return String(clave).split('-')[0] || ''; }
  obtenerHora(clave: any): string { return String(clave).split('-')[1] || ''; }
  
  regresar() { 
    this.router.navigate(['/tabs/perfil']); 
  }

  async cargarEstadisticas() {
    try {
      const querySnapshot = await getDocs(collection(this.firestore, 'Tutores'));
      const conteoCarreras: { [key: string]: number } = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const sedeTutor = (data['sede'] || '').toUpperCase();

        if (this.filtroSedeGraficas === 'GLOBAL' || sedeTutor === this.filtroSedeGraficas) {
          if (data['estado'] === 'ACTIVO') {
            const carrera = data['carrera'] || 'NO ASIGNADA';
            conteoCarreras[carrera] = (conteoCarreras[carrera] || 0) + 1;
          }
        }
      });

      const nombresCarreras = Object.keys(conteoCarreras);
      const cantidadPorCarrera = Object.values(conteoCarreras);

      this.generarGraficoBarras(nombresCarreras, cantidadPorCarrera);
      this.generarGraficoPastel(nombresCarreras, cantidadPorCarrera);
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }

  generarGraficoBarras(labels: string[], data: number[]) {
    if (this.graficoBarras) this.graficoBarras.destroy();
    if (!this.barCanvas) return;
    this.graficoBarras = new Chart(this.barCanvas.nativeElement, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Tutores Activos', data: data, backgroundColor: '#003366', borderRadius: 4 }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
  }

  generarGraficoPastel(labels: string[], data: number[]) {
    if (this.graficoPastel) this.graficoPastel.destroy();
    if (!this.pieCanvas) return;
    this.graficoPastel = new Chart(this.pieCanvas.nativeElement, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: ['#003366', '#d97706', '#10b981', '#ef4444', '#8b5cf6'] }],
      },
      options: { responsive: true },
    });
  }

  async publicarAnuncio() {
    if (!this.nuevoAnuncio.titulo || !this.nuevoAnuncio.descripcion) {
      alert('Por favor, llena el título y la descripción del comunicado.');
      return;
    }

    const payload = {
      titulo: this.nuevoAnuncio.titulo.toUpperCase(),
      descripcion: this.nuevoAnuncio.descripcion,
      fecha_evento: this.nuevoAnuncio.fecha_evento,
      fecha_publicacion: new Date().toISOString(),
      sede_destino: this.nuevoAnuncio.sede_destino.toUpperCase(),
      autor: localStorage.getItem('nombre') || 'COORDINACIÓN',
    };

    try {
      await addDoc(collection(this.firestore, 'Anuncios'), payload);
      alert('¡Comunicado oficial publicado con éxito!');
      this.nuevoAnuncio = { titulo: '', descripcion: '', fecha_evento: new Date().toISOString(), sede_destino: 'GLOBAL' };
    } catch (error) {
      console.error('Error al publicar:', error);
      alert('Error al publicar el comunicado.');
    }
  }
}