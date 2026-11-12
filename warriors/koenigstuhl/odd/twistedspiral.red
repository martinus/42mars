;redcode
;name Twisted Spiral
;author Lukasz Adamowski
;strategy Once I had an idea for multiple different imps launcher, 
;strategy but what I've made was only:
;assert 1

off04	EQU	100
off03	EQU	200
off02	EQU	300
off01	EQU	400

start	
	mov	$imp04,	$imp04+CORESIZE/3+off04
	mov	$imp04,	$imp04+2*CORESIZE/3+off04
	mov	$imp04,	$imp04+off04
	mov	$imp03,	$imp03+CORESIZE/3+off03
	mov	$imp03,	$imp03+2*CORESIZE/3+off03
	mov	$imp03,	$imp03+off03
	mov	$imp02,	$imp02+CORESIZE/3+off02
	mov	$imp02,	$imp02+2*CORESIZE/3+off02
	mov	$imp02,	$imp02+off02
	mov	$imp01,	$imp01+off01
	spl	16
	spl	8
	spl	4
	spl	2
	jmp	$imp02+CORESIZE/3+off02
	jmp	$imp02+2*CORESIZE/3+off02
	spl	2
	jmp	$imp02+off02
	jmp	$imp03+CORESIZE/3+off03
	spl	4
	spl	2
	jmp	$imp03+2*CORESIZE/3+off03
	jmp	$imp03+off03
	spl	2
	jmp	$imp04+CORESIZE/3+off04
	jmp	$imp04+2*CORESIZE/3+off04
	spl	8
	spl	4
	spl	2
	jmp	$imp04+off04
	jmp	$imp02+CORESIZE/3+off02
	spl	2
	jmp	$imp02+2*CORESIZE/3+off02
	jmp	$imp02+off02
	spl	4
	spl	2
	jmp	$imp03+CORESIZE/3+off03
	jmp	$imp03+2*CORESIZE/3+off03
	spl	2
	jmp	$imp03+off03
	jmp	$imp01+off01

imp04	mov.i	#0,	$2*CORESIZE/3+1
imp02	mov.i	#CORESIZE/3+1,	*0
imp03	mov.i	#0,	$CORESIZE/3+1
imp01	mov.i	#0,	$1

	end	start

Pretty big, but not so slow, and very universal. Unfortunately I haven't tested it much and don't know if it's useful in anyway.
Greetings!
Lukasz Adamowski

-= "Hurry to love people, they are leaving so fast. " =-
-= "Spieszmy sie kochac ludzi, tak szybko odchodza." =-


----------------------------------------------------
Grypa? Damy radê! Sprawd¼ jak jej zapobiegaæ, a je¶li ju¿ za pó¼no
..jak leczyæ - grypa.wp.pl
http://klik.wp.pl/?adr=www.grypa.wp.pl&sid=636


