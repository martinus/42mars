;redcode-94nop
;name Usamcinta4
;author hwm
;strategy bscanner based on deathstar with a home cooked qscan variant
;assert 1

S equ 2292

iStp	equ	2667
iAway	equ	6650
qtab3 equ zero
qbomb equ zero

boot    mov     jump+1, dist+13
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
        mov     <bootp, {bootp
bootp   jmp     dist,   jump+1
iDst	jmp	iAway-CURLINE	, #2665
	mov.f	0,	nas
	mov	<iPmp		, {iDst
zero	dat	5,	2300
start	spl #S, >-S
	add.f	-1,1
nas     mov.i >0,-2
nas2	djn.f -2,<-5037 ;907;1102
	mov.f 0, start
iPmp	spl   	#iImp		, #iImp+1
     	sub.f 	#-iStp-1	, iJmp
qtab2 	mov   	iImp		, }iPmp
iJmp	jmp   	iImp-2*(iStp+1) , >iImp+2*iStp-1

iImp	mov.i 	#iStp		, *0
dist    equ     5325 ;4985;3555

        dat zero-1, qa1
qtab1   dat zero-1, qa2


for 10
dat    *S,          }-S
dat.ba start*3777,   start*3177
dat.ba start*3777,   start*3177
rof

step equ 158 

loop    add     #step,  @2
        jmz.b   -1,     @dest
        mov     jump,   @dest
dest    mov     split,  *-2
        jmn     loop,   *0
split   spl     #0,     <0
        mov     6,      >-3
jump    jmp     -1,     0
        dat     <2667,  8

qc2     equ 5927
qb1     equ 4467
qb2     equ 7910
qb3     equ 6306
qa1     equ 2459
qa2     equ 3113
qz      equ 6902
qy      equ 1448


qgo     sne.x     found+qz*qc2     , found+qz*qc2+qb2 ;sne
        seq     <qtab3          , found+qz*(qc2-1)+qb2
        jmp     q0              , }q0
        sne.x     found+qz*qa2     , found+qz*qa2+qb2
        seq     <qtab1          , found+qz*(qa2-1)+qb2
        jmp     q0              , {q0
        sne     found+qz*qa1     , found+qz*qa1+qb2
        seq     <(qtab1-1)      , found+qz*(qa1-1)+qb2
        djn.a   q0              , {q0

        sne.x     found+qz*qb3     , found+qz*qb3+qb3
        seq     <(qtab2+1)      , found+qz*(qb3-1)+(qb3-1)
        jmp     q0              , }q1
        sne.x     found+qz*qb1     , found+qz*qb1+qb1
        seq     <(qtab2-1)      , found+qz*(qb1-1)+(qb1-1)
        jmp     q0              , {q1

        sne.x     found+qz*qb2     , found+qz*qb2+qb2
        seq     <qtab2          , found+qz*(qb2-1)+(qb2-1)
        jmp     q0

        seq     >found           , found+qz+(qb2-1)
        jmp     q2              , <found

        seq     found+(qz+1)*(qc2-1),found+(qz+1)*(qc2-1)+(qb2-1)
        jmp     q0              , }q0
        seq     found+(qz+1)*(qa2-1),found+(qz+1)*(qa2-1)+(qb2-1)
        jmp     q0              , {q0
        seq     found+(qz+1)*(qa1-1),found+(qz+1)*(qa1-1)+(qb2-1)
        djn.a   q0              , {q0
        jmz.f   boot            , found+(qz+1)*(qb2-1)+(qb2-1)

qoff    equ     -86
qstep   equ     -7
qtime   equ     19

q0      mul.b   *2              , found
q2      sne.x     {qtab1          , @found
q1      add.b   qtab2           , found
        mov     qtab3           , @found
found   mov     qbomb           , }qz
        sub     #qstep          , found
        djn     -3              , #qtime
        djn.f   boot            , #0
end

