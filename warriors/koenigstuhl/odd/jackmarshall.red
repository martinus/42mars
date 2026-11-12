;redcode
;name Jack Marshall
;author inverse alien
;strategy empieza en senuelo (whiterabbit), lanza la bomba ,crea una bomba de humo con una spl y limpia
;kill Jack Marshall
;assert CORESIZE == 8000 
;       MAXCYCLES == 80050


	;golpes de gracia para el senuelo
        bang   equ whiterabbit+204 
	fiuu   equ bang+2
	chas   equ bang+72
	badum  equ bang+33
	pium   equ bang+24
	zas    equ bang+63
	pum    equ bang+55
	zasca  equ bang+90
	booum  equ bang+89
	baaam  equ bang+190

	org    whiterabbit; el programa empieza con el senuelo aunque este al final

        tiempo equ 90  ;variable tiempo

	for 0 ;comentario
	;aqui variable peque de step
	for     (CORESIZE == 800)
        ;step   equ 100 ;variable definida 
	rof
	rof

	;he intentado definir un caso para cada coresize pero me da problemas de
	;duplicar la variable step :/ 
 
	;aqui variable normal de step
	;for     (CORESIZE == 8000)
        step   equ 195 ;variable definida 
	;rof

	posi equ 2+tiempo*(step*2-1)



bomba mov    step,       1

jack  mov    bomba,    @dedo ;mueve bomba a donde apunta el dedo ;)
patata  add    #1-step*2,  dedo ;# es inmediato y depende de step, en la primera ronda 1- (195*2)

dedo   mov    bomba,    {posi ;posincremento cuando A es indirecto
       djn    jack,     #tiempo ;contador
dedo2    div.ba #9,         #1 ; hashing mod 9 (normal para core size 8000)
bombadehumo    spl #8,         30 ;crea un nuevo proceso bomba de humo en la dir 8
limpiar   mov    @dedo2,      }patata ; }post incremento de dedo2
        djn.f  limpiar,      >bombadehumo ; B indirecto postincremento

        for    4             ; inicio de bucle
        dat    0,0
        rof		     ; fin de bucle


for 0
whiterabbit es el senuelo que maneja una serie de posiciones indirectas por eso usamos
>,<,} en general toda la info esta en http://vyznev.net/corewar/guide.html 
rof


whiterabbit   mov    >fiuu,    {chas ;chas es indirecto con posincremento y lo propio en fiuu
        mov    <zas,   {badum ;igual, pero precede, no incrementa
        mov    <pum,   {pium
        mov    <zasca, {booum
        djn.f  jack,   <baaam ;atacar, decremento de uno si no es 0
        end ;fin
