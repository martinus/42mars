;redcode-94 
;assert 1 
;name CHaiNS_oF_PaiN
;kill CHaiNS_oF_PaiN
;author Patxy 
;strategy Recon clone with bootstrap & decoy 

Timer equ 400 ; cuanta atrás para el borrado 400*4 posiciones = 1600+1100 >32% 
; Compara posiciones en una horquilla de 6 celdas 
; Cuando se encuentre algo, lo limpia con un manto de 14 SPLs, 
; con este formato: ..X.....X..... 
; Una vez consumido el Timer y cubierto la memoria con una malla de ataques, 
; comenzará con un borrado de memoria. 

rStep equ 6557 
; caza secuencias de pasos de 3, 7, 9, and 11 saltos 
; 6557 * 231 = 2667 (2667 * 3 = 1) 
; 6557 * 99 = 1143 (1143 * 7 = 1) 
; 6557 * 77 = 889 ( 889 * 9 = 1) 
; 6557 * 63 = 5091 (5091 * 11 = 1) 

; Copiamos el guerrero a otra posición de la memoria, a 2/3 de la memoria 
rPlaceA equ 5334
reconA mov rEnd, <rDest ;salto a location A 
mov {reconA, <rDest 
mov {reconA, <rDest 
mov {reconA, <rDest 
mov {reconA, <rDest 
rSrc jmn reconA, {reconA 
rDest spl rPlaceA+5, rPlaceA+15 
for 5 
dat 0, 0 
rof 

;warrior: SNE scanner con SPL wiper 
rPtr equ (rScan-8) 
dat 0, 0 
dat 19, 19 
rDiff spl #-rStep, #-rStep 
rWipe mov rDiff, >rPtr ; golpea con una capa de SPLs 
rW2 mov *rWipe, >rPtr ; más tarde >> borrado de la memoria 
djn.a rWipe, rLength 
rLoop sub rDiff, @rS2 
rScan sne (rStep-1), (rStep-7) ; compara 2 posiciones 
sub rDiff, rScan 
rS2 seq *rScan, @rScan ; compara otras 2 posiciones 
slt.a #20, rScan ; evita sus posiciones del scanner 
rTimer djn rLoop, #Timer ; cuenta-atrás para el borrado de la memoria 
rLength sub.ba #0, #-7 ; inicializa la capa de SPLs 
rTweak mov.ab @rS2, @rWipe 
rT2 jmn *rW2, rTimer ; cuando el contador expire, 
rEnd djn.a <rTweak, {rT2 ; comenzamos el borrado de la memoria 

for 5 
dat 0, 0 
rof 

;decoy 
idx for (MAXLENGTH-CURLINE) 
SPL.F ((1+idx%6)*23),((1+idx%6)*91) ; decodificación enorme para confundir a los scanners 
rof 
end reconA 

