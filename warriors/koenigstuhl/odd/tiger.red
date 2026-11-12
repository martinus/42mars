;redcode-94t
;name Tiger
;author Sascha Zapf
;       CORESIZE==8192
;assert 1
;strategy Q4.5 -> Paper/Stone

sstep1 equ 817
sstep2 equ 5687
sstep3 equ 4585
sstep4 equ 6587
sstep5 equ 527
sstep6 equ 1260

sbootdis equ 1294

pstep1 equ 6151
pstep2 equ 2432
pstep3 equ 1651
bombdis equ 3566

pbootdis equ 2141
sdis1 equ 5960
sdis2 equ 1854

qtab3   mod.f }0,>qc2
		dat 0,0
qbomb	mod.f }0,>1
		dat 0,0
launch	spl	1, <qb1
qtab2	spl	1, <qb2
		spl sdis1, <qb3
		mov.i }qtab1,}-1
		spl sdis2
		mov.i }qtab1-1,}-1
		spl	1
		mov.i	<pboot,{pboot
pboot	spl		launch+pbootdis,psilk+8
		mov.i	<sboot,{sboot
sboot	jmp		launch+sbootdis,ssilk+8
		dat		cSp,qa1
qtab1	dat		cSp,qa2

space1 equ 28

for space1
dat 0,0
rof


ssilk	spl	@0,			<sstep1
		mov.i	}-1,	>-1
		spl sstep2, 0
		mov.i >-1, }-1
		spl	#sstep3,	>sstep4
		mov	{sstep5,	{sstep6
		add	-2,	-1
		djn.f @0, {-2

psilk	spl    @0,  <pstep1
		mov.i  }-1,    >-1
		spl    pstep2, #0
		mov.i  >-1,	}-1
		spl    @0, <pstep3
		mov.i  }-1, >-1
bomb	mov.i  #1,     <1
		djn.b  -2,<bombdis

; 58 bis hier

for 70
dat 0,0
rof
step equ 183
dj equ 6377;1151

cSp		spl	#0, <-dj+3
		mov.i	step, cAd-(step*3500)
cAd 	add.ab	{0, }0
		djn.f	-2, <-dj

for 70
dat 0,0
rof

; 39 qscan
;-----------------------------------------------------
;extended Q^4 scan

qc2 equ ((1 + (qtab3-qptr)*qy) % CORESIZE)
qb1 equ ((1 + (qtab2-1-qptr)*qy) % CORESIZE)
qb2 equ ((1 + (qtab2-qptr)*qy) % CORESIZE)
qb3 equ ((1 + (qtab2+1-qptr)*qy) % CORESIZE)
qa1 equ ((1 + (qtab1-1-qptr)*qy) % CORESIZE)
qa2 equ ((1 + (qtab1-qptr)*qy) % CORESIZE)
qz equ 2108
qy equ 243
; qy * (qz-1) = 1

;q0 mutation
qgo sne qptr + qz*qc2, qptr + qz*qc2 + qb2
 seq <qtab3, qptr + qz*(qc2-1) + qb2
 jmp q0, }q0
 sne qptr + qz*qa2, qptr + qz*qa2 + qb2
 seq <qtab1, qptr + qz*(qa2-1) + qb2
 jmp q0, {q0
 sne qptr + qz*qa1, qptr + qz*qa1 + qb2
 seq <(qtab1-1), qptr + qz*(qa1-1) + qb2
 djn.a q0, {q0
;q1 mutation
 sne qptr + qz*qb3, qptr + qz*qb3 + qb3
 seq <(qtab2+1), qptr + qz*(qb3-1) + (qb3-1)
 jmp q0, }q1
 sne qptr + qz*qb1, qptr + qz*qb1 + qb1
 seq <(qtab2-1), qptr + qz*(qb1-1) + (qb1-1)
 jmp q0, {q1
;no mutation
 sne qptr + qz*qb2, qptr + qz*qb2 + qb2
 seq <qtab2, qptr + qz*(qb2-1) + (qb2-1)
 jmp q0
;qz mutation
 seq >qptr, qptr + qz + (qb2-1)
 jmp q2, <qptr
;q0 mutation
 seq qptr + (qz+1)*(qc2-1), qptr + (qz+1)*(qc2-1) + (qb2-1)
 jmp q0, }q0
 seq qptr + (qz+1)*(qa2-1), qptr + (qz+1)*(qa2-1) + (qb2-1)
 jmp q0, {q0
 seq qptr + (qz+1)*(qa1-1), qptr + (qz+1)*(qa1-1) + (qb2-1)
 djn.a q0, {q0
;no mutation
 jmz.f launch, qptr + (qz+1)*(qb2-1) + (qb2-1)

qoff equ -87
qstep equ -8
qtime equ 6

q0 mul.b *2, qptr
q2 sne {qtab1, @qptr
q1 add.b qtab2, qptr
 mov qtab3, @qptr
qptr mov qbomb, }qz
 sub #qstep, qptr
for qtime-1			; Enough space, so why not unroll the bombing?
 mov qtab3, @qptr
 mov qbomb, }qz
 sub #qstep, qptr
rof
 jmp launch

end qgo

