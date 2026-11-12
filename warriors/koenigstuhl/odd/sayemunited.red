;redcode-odd
;name Sayembara United
;author Zul Nadzri
;assert 1
;strategy - Start game with all out attack. Formation 3-3-4 Attacking
;strategy - Change tactic to counter attack at halftime
;strategy - Switch formation to 5-4-1 Passing. Try to pass to striker and shoot for a win.

value equ 3456  ; just for Koenigstuhl [CCB]

;--------------------- Phase 0 - Kickoff

goal 	  equ value
ball 	  equ value
top 	  equ qbomb-100
bot 	  equ qbomb+200
span	  equ 55
placeP  equ 4411 
pStep1  equ 4208 
pStep2  equ 7795 
zero    equ qbomb
qtab3   equ qbomb
placeS  equ 970

;--------------------- Phase 3 - Shoot at will
qbomb jmp #qoff, #qc2

qbomb2  jmp  #0, qb1
qtab2   jmp  1, qb2
kick    jmp  0, qb3

b	sne.ab #goal, qbomb-1
	jmp b1
b0	sub #1, b
	djn b, #7900
stun	jmp #0,#1

found	seq.a #0, *start
	mov stun, *start
	seq.a #0, @start
	mov stun, @start
	jmp cycle, 0	

	dat 0, 0
box	mov incr-1, qbomb-2
	jmp -1, 0
	dat 0, 0

dat zero - 1, qa1
qtab1 dat zero - 1, qa2

a1	mov.ba a, kick
	sub.a #box-a,kick
	mul.a #-1, kick
	mov kick, @a
	jmp a0

b1	mov.b b, kick
	add.ab #b-box, kick
	mov.b kick, box
	jmp b0

;-------------------- Phase 2 - Switch tactic to counter attack
	dat 0, 0

incr	dat #-20, #20
shift dat #-3, #-3
reset	seq.a top-10, bot+20
next	add incr, start
start	seq.a top, bot+10	
	jmp found
	add incr, start
	seq.a *start, @start
	jmp found
	add incr, start	
	seq.a *start, @start
	jmp found
	add incr, start
	seq.a *start, @start
	jmp found		
	add incr, start
	seq.a *start, @start
	jmp found
	add incr, start
	seq.a *start, @start
	jmp found
	add incr, start
	seq.a *start, @start
	jmp found
cycle	djn next, #span		
	mov.i reset, start
	mov.ab #span-2, -2
	add shift, reset
	djn start, #11

a	sne.ab #ball, incr-1
	jmp a1
a0	sub #1, a
	djn a, #7900
	jmp b

;--------------------- Phase 1 - All out attack !
qc2 equ ((1 + (qtab3-qptr)*qy) % CORESIZE)
qb1 equ ((1 + (qtab2-1-qptr)*qy) % CORESIZE)
qb2 equ ((1 + (qtab2-qptr)*qy) % CORESIZE)
qb3 equ ((1 + (qtab2+1-qptr)*qy) % CORESIZE)
qa1 equ ((1 + (qtab1-1-qptr)*qy) % CORESIZE)
qa2 equ ((1 + (qtab1-qptr)*qy) % CORESIZE)
qz equ 2108
qy equ 243
qgo sne.a qptr + qz*qc2, qptr + qz*qc2 + qb2
 seq.a <qtab3, qptr + qz*(qc2-1) + qb2
 jmp q0, }q0
 sne.a qptr + qz*qa2, qptr + qz*qa2 + qb2
 seq.a <qtab1, qptr + qz*(qa2-1) + qb2
 jmp q0, {q0
sne.a qptr + qz*qa1, qptr + qz*qa1 + qb2
 seq.a <(qtab1-1), qptr + qz*(qa1-1) + qb2
 djn.a q0, {q0
 sne.a qptr + qz*qb3, qptr + qz*qb3 + qb3
 seq.a <(qtab2+1), qptr + qz*(qb3-1) + (qb3-1)
 jmp q0, }q1
sne.a qptr + qz*qb1, qptr + qz*qb1 + qb1
 seq.a <(qtab2-1), qptr + qz*(qb1-1) + (qb1-1)
 jmp q0, {q1
 sne.a qptr + qz*qb2, qptr + qz*qb2 + qb2
 seq.a <qtab2, qptr + qz*(qb2-1) + (qb2-1)
 jmp q0
 seq.a >qptr, qptr + qz + (qb2-1)
 jmp q2, <qptr
seq.a qptr+(qz+1)*(qc2-1),qptr+(qz+1)*(qc2-1)+(qb2-1)
 jmp q0, }q0
seq.a qptr+(qz+1)*(qa2-1),qptr+(qz+1)*(qa2-1)+(qb2-1)
 jmp q0, {q0
seq.a qptr+(qz+1)*(qa1-1),qptr+(qz+1)*(qa1-1)+(qb2-1)
 djn.a q0, {q0
 jmz.f start, qptr + (qz+1)*(qb2-1) + (qb2-1)
qoff equ -87
qstep equ -5
qtime equ 20
q0 mul.b *2, qptr
q2 sne {qtab1, @qptr
q1 add.b qtab2, qptr
 mov qtab3, @qptr
qptr mov qbomb, }qz
 sub #qstep, qptr
 djn -3, #qtime
 jmp start

end qgo
;end start
