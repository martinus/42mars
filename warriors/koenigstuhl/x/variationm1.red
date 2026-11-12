;redcode-94x
;name Variation M-1
;author Jay Han
;assert CORESIZE==55440
;macro

		org	start

; Mod-2 stone
; 27739	   34, Hits 3 on 4076, Hits -3 on 7337, Hits 5 on 12229, Hits -1 on 15490, Hits 1 on 23644.
; 27705 55406, Hits 1 on 4076, Hits -1 on 12229, Hits 5 on 15490, Hits -3 on 20382, Hits 3 on 23644.

p1		equ	27739
s1		equ	34
p2		equ	27705
s2		equ	-34

gate		equ	inc+s2

loop		add.f	inc,		cast
stone		spl.b	loop,		<gate		; mutate into patch
cast		mov.i	<p1,		p2
buckle		djn.f	stone,		<gate
patch		djn.b	inc-stone,	<gate-stone
stop		dat.f	<gate-buckle,	#1
inc		spl.b	#s1,		<s2		; B is negative
clear		mov.i	plug,		<patch+1
plug		dat.f	<gate,		<gate+1

for 143
		dat.f	0,		0
rof

split		spl.b	#0,		<-19
wimp		djn.f	#0,		<-20
start		spl.b	stone,		<bound+trash
newimp		mov.i	wimp,		cast+27722
		mov.i	split,		<newimp
		spl.b	@newimp,	<bound+trash*2

; makeimp v3: Automatic imp-spiral generator by Jay Han, 5/6/1994.
; 38-process 19-point spiral (size 55440, '94) (trashing)
step		equ	29179
launch
		spl	1,		<bound+3*trash
		spl	lbl3,		<bound+4*trash
		spl	lbl5,		<bound+5*trash
		spl	lbl9,		<bound+6*trash
		spl	lbl17,		<bound+7*trash
		spl	lbl33,		<bound+8*trash
		jmp	>0,		imp+0*step
lbl33		jmp	>0,		imp+1*step
lbl17		spl	lbl35,		<bound+9*trash
		jmp	>0,		imp+2*step
lbl35		jmp	>0,		imp+3*step
lbl9		spl	lbl19,		<bound+10*trash
		spl	lbl37,		<bound+11*trash
		jmp	>0,		imp+4*step
lbl37		jmp	>0,		imp+5*step
lbl19		spl	lbl39,		<bound+12*trash
		jmp	>0,		imp+6*step
lbl39		jmp	>0,		imp+7*step
lbl5		spl	lbl11,		<bound+13*trash
		spl	lbl21,		<bound+14*trash
		spl	lbl41,		<bound+15*trash
		jmp	>0,		imp+8*step
lbl41		jmp	>0,		imp+9*step
lbl21		spl	lbl43,		<bound+16*trash
		jmp	>0,		imp+10*step
lbl43		jmp	>0,		imp+11*step
lbl11		spl	lbl23,		<bound+17*trash
		spl	lbl45,		<bound+18*trash
		jmp	>0,		imp+12*step
lbl45		jmp	>0,		imp+13*step
lbl23		spl	lbl47,		<bound+19*trash
		jmp	>0,		imp+14*step
lbl47		jmp	>0,		imp+15*step
lbl3		mov	<bound+trash*20, <bound+21*trash ; Idle
		mov	<bound+trash*22, <bound+23*trash ; Idle
		spl	lbl25,		<bound+24*trash
		spl	lbl49,		<bound+25*trash
		jmp	>0,		imp+16*step
lbl49		jmp	>0,		imp+17*step
lbl25		mov	<bound+trash*26, <bound+27*trash ; Idle
		jmp	>0,		imp+18*step
imp		mov.i	#0,		step
trash		equ	1958
bound		equ	imp+200

