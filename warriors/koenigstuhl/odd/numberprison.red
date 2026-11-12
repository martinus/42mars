;redcode
;name Number Prison
;author Jakub Kozisek
;strategy oneshot -> s/d clear
;strategy scanning loop -> basic 0.5c JMZ.F one
;strategy clear	-> spl (0.5c, just a little bit) -> dat (0.66c, whole core)
;assert 1

; first name:	Number
; surname:	Prison
; birthplace:	/zaloha/Games/corewars/local/warriors/fizmo/rnd9
; parents:	noname oneshot, thrash bin
; job:		murderer (I hope)

; FAQ section: 		;)

; Q: Jakub? S/D clear? How? -c is ONLY 100000, so how can you wipe whole clear
; with SPL and then with DAT?
;
; A: The trick is, that I'm not wiping whole core with SPL and then DAT.
; I took Monowire-like s/d clear, and added into SPL's a-field not-so-big(R)
; number (1328 in this case), so only some cells are wiped with SPL and
; then DAT clear is launched.
; I hope this will be enough to slow down nasty papers before unleashing hell.
; (read "DAT clear")

	;========================
	nop	}1,	>1	;#
	mul.f	#1,	#1	;##
	add.ab  -1,	-1	;###
	mov.f	@-1,	1	;#### generate not-so-big(R) number and
	mul.ab	#0,	#0	;####    put it into right place
	add.f	-1,	@1	;###
	mul.ba	1,	1	;##
	add.a   #1,	1	;#
	;========================
	add.f	1,	@1	;#
	nop	>1,	1	;##
	mul.x	#1,	#1	;###
	add.ab	-1,	-1	;##### mov.i @1, >-1 => mov.i @2, >-2
	add.f	@-1,	1	;##### mov.i @1, >-1 => mov.i @1, >-3
	add.x	#1,	#1	;##### (yes, I know, I know, its ugly)
	add.f	-1,	1	;####
	nop	}1,	<1	;### <- this will get scanned => start clear
	add.f	-1,	1	;##
	nop	<-1,	<-1	;#
	;========================
	nop	}1,	>1	;#
	mul.f	#1,	#1	;##
	add.ab	-1,	-1	;###
	add.f	@-1,	1	;#### djn.f -1, {1  => djn.f -1, {2
	add.x	#0,	#1	;###
	add.f	-1,	1	;##
	nop	1,	>1	;# <= a-field is lazy :)
	;========================
	nop	}1,	>1	;#
	mul.f	#1,	#1	;##
	add.f	-1,	-1	;###  dat   #-1, 1  => dat  #-8, 9
	add.f	@-1,	@1	;###  spl   #x,  1  => spl  #8*x,10
	mul.f	1,	>1	;##
	mul.f	#0,	1	;#
	;========================
	add.b	-1,	-1	;#  add.ab #0, 1  => add.ab #20, 1
	mov.ba	@-1,	1	;#  BOING!!! - and we have #STEP
	;########################
	add.ab	#0,	1	;#  main scan loop - 0.5c jmz.f scanner
	jmz.f	-1,	1	;#  :)
	;========================
	spl	#0,	{-1	;#
	mov.i	@1,	>-1	;## <0.5c SPL clear =>
	mov.i	@1,	>-1	;##                    <0.66c DAT clear
	djn.f	-1,	{1	;#
	;========================
	dat	#-1,	<1	;#  food for the
	spl	#1,	#1	;#     ENEMY
	;========================
