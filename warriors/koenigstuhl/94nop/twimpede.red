;redcode-94
;name Twimpede+/8000-d1
;author Jay Han
;strategy Start imp-spiral for life insurance
;strategy Then stone -> core-clear -> gate/decrement
;strategy Mod-2 stone
;strategy Added a wimp for extra durability
;strategy Added better imp-gate
;kill Twimpede
;assert CORESIZE==8000
;macro

	org start

; Mod-2 stone
;    75    74, Hits 3 on 972, Hits 5 on 1945, Hits -3 on 2053, Hits -1 on 3026, Hits 1 on 4000.
; -2391    74  2395   -74  2195  4000  50.0     1  4000

p1		equ	-2391
s1		equ	74
p2		equ	2395
s2		equ	-74

gate		equ	inc+s2

patch		djn.b	3,		<gate-stone
loop		add.f	inc,		cast
stone		spl.b	loop,		<gate		; mutate into patch
cast		mov.i	<p1,		p2
buckle		djn.f	stone,		<gate
inc		spl.b	#s1,		<s2		; B is negative
clear		mov.i	plug,		<buckle+1
plug		dat.f	<inc+s2,	<inc+s2+1
		dat.f	0,		patch+1

for 41
		dat.f	0,		0
rof

wimp            spl.b   #0,             <gate
                djn.f   #0,             <gate
start		spl.b	stone
		spl.b	wimp

; 22-process 11-point spiral (coresize 8000, '94 standard)
step	equ	5091
launch
	spl	lbl3
	spl	lbl5
	spl	lbl9
	spl	lbl17
	spl	lbl33
	jmp	imp+0*step+0
lbl33	jmp	imp+1*step+0
lbl17	spl	lbl35
	jmp	imp+2*step+0
lbl35	jmp	imp+3*step+0
lbl9	spl	lbl19
	spl	lbl37
	jmp	imp+4*step+0
lbl37	jmp	imp+5*step+0
lbl19	spl	lbl39
	jmp	imp+6*step+0
lbl39	jmp	imp+7*step+0
lbl5	spl	lbl11
	spl	lbl21
	spl	lbl41
	jmp	imp+8*step+0
lbl41	jmp	imp+9*step+0
lbl21	spl	lbl43
	jmp	imp+10*step+0
lbl43	jmp	imp+0*step+1
lbl11	spl	lbl23
	spl	lbl45
	jmp	imp+1*step+1
lbl45	jmp	imp+2*step+1
lbl23	spl	lbl47
	jmp	imp+3*step+1
lbl47	jmp	imp+4*step+1
lbl3	mov	#0,	#0
	spl	lbl13
	spl	lbl25
	spl	lbl49
	jmp	imp+5*step+1
lbl49	jmp	imp+6*step+1
lbl25	spl	lbl51
	jmp	imp+7*step+1
lbl51	jmp	imp+8*step+1
lbl13	mov	#0,	#0
	spl	lbl53
	jmp	imp+9*step+1
lbl53	jmp	imp+10*step+1
imp	mov.i	#-step,	step

		end

