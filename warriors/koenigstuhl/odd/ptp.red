;redcode-rf20
;name Polish Traditional Papercut
;author Lukasz Adamowski
;assert 1

FOR	0

; ========================
; Pool B - 15 Instructions
; ========================

PB00   spl    @    1 , # 2667
PB01   mov.i  #    2 , * 1143
PB02   dat    <    3 , <  889
PB03   sne.i  < 1000 , @ 1006
PB04   seq.i  <    4 , $   17
PB05   add.f  $    5 , $    7
PB06   jmp    @    6 , <   61
PB07   jmz.f  $   -6 , >   95
PB08   mov.i  *   -5 , <   13
PB09   djn.b  $   -4 , #    0
PB10   spl    # 3044 , # 2365
PB11   mov.ab <   -3 , $   12
PB12   slt.a  $   -3 , $   -9
PB13   mov.i  >   -2 , }   -8
PB14   jmp    $   -1 , {   -7

; Swap instructions PB07 and PB01 : 3 AP 
; Change A-field addressing mode in PB08 to < : 4 AP
; Flip A-field addressing mode in PB10 : 2 AP

; Total AP used : 9 

ROF

; ===============
; Pool B modified
; ===============

PB00   spl    @    1 , # 2667
PB01   jmz.f  #    2 , * 1143
PB02   dat    <    3 , <  889
PB03   sne.i  < 1000 , @ 1006
PB04   seq.i  <    4 , $   17
PB05   add.f  $    5 , $    7
PB06   jmp    @    6 , <   61
PB07   mov.i  $   -6 , >   95
PB08   mov.i  <   -5 , <   13
PB09   djn.b  $   -4 , #    0
PB10   spl    $ 3044 , # 2365
PB11   mov.ab <   -3 , $   12
PB12   slt.a  $   -3 , $   -9
PB13   mov.i  >   -2 , }   -8
PB14   jmp    $   -1 , {   -7

start	EQU	boot+200

boot	sub.b	PB10,	PB10
	mov	PB10,	start
	mul.a	PB05,	start
	mov	PB10,	start+2
	mul.a	PB10,	start+2
	sub.f	PB13,	PB13
	nop	{PB13,	<PB13
	mov	PB13,	start+1
	mov	PB13,	start+3
	sub.ba	PB12,	PB07
	mov	PB07,	start+6
	add.ab	}PB07,	PB07
	mov	PB07,	start+5
	mul.b	}PB07,	PB07
	mov	PB07,	start+4
	mov	PB08,	start+7
	sub.b	PB11,	start+7
	sub.a	PB06,	PB06
	mul.b	PB04,	PB06
	mov	PB06,	start+8
	sub.f	PB02,	PB02
	add.ba	PB00,	PB02
	add.b	PB00,	PB02
	add.b	PB00,	PB02
	mov	PB02,	start+9
	
	spl	1
	mov	-1,	0
	mov	-1,	0
	spl	1
	mov	boot-100,	>jump
	mov	boot-100,	>jump
	mov	boot-100,	>jump
	mov	boot-100,	>jump
	mov	boot-100,	>jump
	
jump	jmp	start,	PB00-1

	end	boot
	
