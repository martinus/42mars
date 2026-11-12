;redcode-rf20
;name Being
;author Lukasz Adamowski
;assert 1

start	EQU	boot+100
begin	EQU	PB00-1

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

; No action points used.

; The Creator's Code
boot	mov.i	PB09,	start+5
	add.b	PB07,	start+5
	add.f	PB07,	start+5
	add.f	PB05,	start+5
	mov.i	PB08,	start+6
	sub.b	PB04,	start+6
	mov.i	PB13,	start+7
	add.x	PB04,	start+7
	sub.ab	PB05,	PB05
	add.ba	PB14,	PB05
	mov.i	PB05,	start
	mov.i	PB05,	start+1
	sub.b	PB02,	PB02
	add.ba	PB04,	PB02
	mov.i	PB02,	start-1
	mov.ab	PB02,	start-1
	sub.ab	PB02,	PB02
	mov.i	PB02,	start-2
	mov.ba	PB02,	start-2
	sub.ab	PB11,	PB04
	add.a	PB06,	PB04
	mov.i	PB04,	start+3
	sub.f	PB03,	PB03
	sub.x	PB04,	PB03
	mov.i	PB03,	start+2
	mov.i	PB14,	start+4
	sub.a	PB12,	start+4
	nop	}PB09,	}PB09
	add.b	PB08,	PB09
	mov.i	PB09,	start+8
	sub.f	PB01,	PB01
	nop	}PB01,	$404
	mov	PB01,	start+9

; The Make-It-Clean Code

	spl	1
	spl	1
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
	mov	begin-1,	>jump
jump	jmp	start,	PB00-1

	end	boot

FOR	0
; Here is what we want to have created

	dat	<-20,	<-20
	dat	<20,	<20
start	add.f	$-2,	$2
	add.f	$-2,	$2
	sne.i	<-20,	@-10
	seq.i	<10,	$20
	jmp	$2,	{-7
	djn.b	$-5,	#197
	mov.i	*-5,	<-4
	mov.i	>15,	}-4
	djn.b	$-2,	#13
	mov.i	#1,	*0

	end	start
ROF
	
