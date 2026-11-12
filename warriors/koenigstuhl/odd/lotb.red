;redcode-rf20
;name Lord of the bricks
;author G.Labarga
;assert CORESIZE==8000
;strategy P-spacer: Stone/imp or paper/imp

; ========================
; Original Pool A - 10 Instructions
; ========================
;- Just to compare
;PA00   spl    $  199 , #   17
;PA01   jmp    @   11 , <   47
;PA02   mov.i  *   -3 , }   -3
;PA03   mul.ab #  367 , $    0
;PA04   spl    @  -10 , #   10
;PA05   mov.i  > 2667 , }   -5
;PA06   mov.i  # 1143 , $   -2
;PA07   mod.f  $   -1 , $   16
;PA08   sne.b  $   22 , $ 3044
;PA09   sub.a  $    0 , $ 2365

;-----------------------------

; ========================
; Pool A - 10 Instructions
; ========================

PA00   spl    $  199 , #   17
PA01   jmp    @   11 , <   47
PA02   mov.i  *   -3 , }   -3
PA03   mul.ab #  367 , $    0
PA04   spl    @  -10 , #   10
PA05   mov.i  > 2667 , }   -5
PA06   mov.i  # 1143 , $   -2
PA07   mod.f  $   -1 , $   16
PA08   sne.b  $   22 , $ 3044
PA09   sub.b  $    0 , # 2365	;flip a-modiffier and b-addressing: 4AP

lloc equ (llch+200)
iloc equ (lloc+14)
llch:	mov.i PA00,@dst3	;spl 0,#-1144
	sub.f PA00,@dst3
	sub.ab PA06,@dst3
	add.ab PA07,>dst3
	mov.i PA02,@dst3	;mov.i *(imp),} imp
	add.b PA07,@dst3
	sub.a #PA01,>dst3	;mov.a #12,>dst3
	mov.i PA09,@dst3	;sub.b -2,# imp-1144
	mov.ba PA06,@dst3
	mov.ab PA01,@dst3
	sub.ab PA06,>dst3
	mov.i PA01,@dst3	;jmp @-1,<-10
	mov.a PA07,@dst3
	mov.ab PA04,@dst3
	mov.i PA06,@idst	;mov.i #1,1143
	mov.x PA06,@idst
	sub.a PA02,@idst
;--- 27 ins
sloc equ llch+4700
lsto:	mov.i PA00,@dst2	;spl
	mov.f *PA00,>dst2
	mov.i PA05,@dst2	;mov
	mov.x PA05,>dst2
	mov.i PA03,@dst2	;mul
	mov.a PA01,@dst2
	mov.ab PA07,>dst2
	mov.i PA01,@dst2	;jmp
	mov.a PA07,@dst2
	mov.b PA06,>dst2
;--38 ins

	spl *1,<1
idst:	spl *1,}iloc
dst2:	spl 1,sloc
wipe:	mov dst+1,>wptr
	mov dst+1,{4
	mov dst+1,{3
	mov dst+1,>wptr
	mov dst+1,>wptr
	mov dst+1,{0		;not cleared when stone/imp is launched: 1 AP
wptr:	jmn wipe,PA00		;not cleared when stone/imp is launched: 1 AP
	djn sloc,#5		;not cleared when stone/imp is launched: 1 AP
dst3:	jmp lloc,lloc

RESULT:	dat 0,5			;P-brain: P^3 switcher
	dat 0,6
	dat 0,7
think:	LDP.A @1,RESULT
	LDP.BA 2,STATE
	MOD.BA *RESULT,STATE
	STP.B *STATE,#75
STATE:	JMP }0,#162		;state0: s/i
TABLE:	jmp llch,72		;state1: s/i
	jmp plch,38		;state2: p/i
	jmp plch,74		;state3: p/i
	jmp plch,110		;state4: p/i
	jmp plch,50		;state5: p/i
;-- 62
ploc equ PA03+367-1
plch:	mov.i PA00,@dst
	mov.x PA09,>dst
	mov.i PA05,@dst		;<-ref11
	mov.a PA07,@dst
	mov.ab PA07,>dst	;<-ref10
	mov.i PA00,@dst
	mov.f PA03,>dst
	mov.i *PA03,>dst	;<-ref17
	mov.i PA00,@dst		;spl 0
	sub.f PA00,@dst
	sub.ab PA06,>dst
	mov PA09,@dst
	;mov.x *PA08,@dst	;mov.a PA07,@dst
	mov.b PA01,PA05
	mov.x @PA05,@dst
	sub.x PA06,>dst		;(must be -1142) ;<-ref16
	mov.i PA01,@dst		;\.
	mov.a PA07,@dst		; > jmp instruction :(
wptp:	sub.ab PA00,>dst	;/.
	mov.i PA06,@dst
	mov.x PA06,>dst

launch:	spl 1
	spl 1
	mov dst+1,>wptt
	spl 1
trick:	mov dst+1,>wptt
	mov dst+1,>wptt
	mov dst+1,>wptt
	mov dst+1,>wptt
	mov dst+1,>wptt
	mov dst+1,>wptt
wptt:	jmn -5,PA00		;not cleared when paper/imp is launched: 1 AP
dst:	jmp ploc,ploc

end think

;--- AP cost:
;- 4+3 when stone/imp is launched
;- 4+1 when paper/imp is launched
;So maximum cost is 7 AP.

;plch should create this:
;spl 2365,#0
;mov.i >-1,}-1
;spl 367,#0
;mov.i >-1,}-1
;spl 0,#-1143
;sub.b -1,#-1142
;jmp @-1,<-152
;mov.i #-2,1143



