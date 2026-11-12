;redcode
;name Plus ultra
;author G.Labarga
;assert 1
;strategy	Qscan-> Extended adaptative switcher: stone/imp or blur-style scanner
;strategy	Using Metcalf's Qscan from Vala. Just changed it very slightely.
;strategy	Redcoders Frenzy Tournament, round 14 "Extended '88". November 2003.
;	Vulnerable to Qscans and paper+stone
; Extended adaptative switcher, Results record=2.
; It tries to compensate the lack of patience of the adaptative switcher
; Saves in p-space a table with the strats to execute after every two
;  consecutive results
; It should increase the score against table-based switchers
;saving three results would be great, but a bit too big.
;i don't know if is better saving in the table strategies or switches, (like p-key's brain does)

;p-space:	( 0 -> result )
;		491-499 -> to-do table
;		490 -> last table cell used
;		489 -> previous result

;	TO-DO table: cell=491+3*prev+result
;	491: l l	;after two consecutive loses
;	492: l w	;after loss and win
;	493: l t	;after loss and tie
;	494: w l	;...
;	495: w w
;	496: w t
;	497: t l
;	498: t w
;	499: t t
; EQU list
;stone/imp
	bstep equ 67*2
	trail1 equ -1200
	trail2 equ -1600
	d1 equ hit+bstep
	d2 equ hit+2*bstep
	stloc equ self+1100
	iploc equ stloc+401
	ifrst equ 200
;scanner
	cmod equ 4
	sstep equ 19*2*cmod
	gate equ loop-2
;p-brain
	final equ igo	;<”ltima instruccin>
	p_prev equ 489
	p_last equ 490
	strat1 equ boot		;Stone/imp
	strat2 equ hool		;Blur scanner
;Qscan
        qf equ (qgo+1*qs)
        qd equ 135
        qs equ (2*qd)
        qi equ 7                             
        qr equ 7

qbomb   dat <-49,<50
        dat #12*qs      ;a
qp1     dat #5*qs       ;b
qp2     dat #2*qs       ;c
qp3  ;  dat #1*qs       ;d

qgo     cmp qd+qf,      qf ;d
        jmp qskip,      <qf+4

        cmp qd+qf+qs*5, qf+qs*5
        jmp qfast,      <qf+qs*5+4
        cmp qd+qf+qs*12,qf+qs*12
q1      djn qfast,      #qp1

        cmp qd+qf+qs*7, qf+qs*7
        jmp qslow,      <qf+qs*7+4
        cmp qd+qf+qs*14,qf+qs*14
        jmp qslow,      <q1
        cmp qd+qf+qs*10,qf+qs*10
q2      djn qslow,      #qp2
        cmp qd+qf+qs*2, qf+qs*2
        jmp qslow,      <qfast

        cmp qd+qf+qs*8, qf+qs*8
        jmp qslower,    <qf+qs*8+4
        cmp qd+qf+qs*15,qf+qs*15
        jmp qslower,    <q1
        cmp qd+qf+qs*11,qf+qs*11
        jmp qslower,    <q2
        cmp qd+qf+qs*9, qf+qs*9
q3      djn qslower,    #qp3
        cmp qd+qf+qs*3, qf+qs*3
        jmp <qfast,     <qf+qs*3+4
        cmp qd+qf+qs*6, qf+qs*6
        jmp <qfast,     <q2
        cmp qd+qf+qs*4, qf+qs*4
        jmp <qfast,     <q3
        cmp qd+qf+qs*16,qf+qs*16
        slt <q3,        <q1

        jmz pthink,        qd+qf+qs*8+10

qslower add @q3,        @q2
qslow   add @q2,        qkil
qfast   add @q1,        @qslow
qskip   jmn qloop,      @qkil
        add #qd,        qkil
qloop   mov qbomb,      @qkil
qkil    mov qbomb,      <qf
        sub #qi,        @qloop
        djn qloop,      #7

pthink:	ldp #p_prev,prev
	ldp #p_last,qslow	;last
	slt #490,qslow		;brainwash detection or first round
	jmp bw,<final+10
result:	ldp #0,0
	jmn calc,@result	;modify if didn't win
lstr:	ldp qslow,0	;last,0
mdfy:	sub lstr,qskip	;lstr,#3		;= 1 or 2
last:	stp qskip,qslow	;mdfy,#0

calc:	add @prev,addr
	add result,addr
slct:	ldp addr,go
	stp addr,clop+1	;#p_last

go:	jmn @0,0
	jmp @0,strat1
	jmp @0,strat2

bw:	stp #1,@1		;configure memory table
	jmz -1,<final+10
addr:	jmp slct+1,#491

loop:	mov smb,<ptr		;It is Hooligan'88
scan:	cmp <sstep-cmod,<sstep
	mov -1,ptr
	sub sinc,scan
	jmn loop,scan
smb:	spl 0,<1-sstep
clop:	mov sinc,<gate
	djn clop,<gate-1
sinc:	dat <-sstep,<-sstep
ptr:	dat <2667,<4000

self:	spl 0,0
	spl 0,<-3
ref:	mov <d1,<d2
hit:	sub binc-2,ref
	djn -2,<trail1

prev:	dat #0,#0		;can't use MUL so here is prev*3
hool:	mov <hsrc,<3
	mov <self,<6
	djn -2,#5
hgo:	djn @0,#imp+2667-5

ipmp:	spl 0,ifrst
	add #2667,ipmp
	djn @ipmp,<trail2

imp:	mov 0,2667
binc:	dat <-2*bstep,<-2*bstep

boot:	mov imp,iploc-3+ifrst+(4*2667)
	mov binc,stloc+7
	mov <pthink,<sgo
	mov <isrc,<igo
hsrc:	spl 1,smb
	mov <isrc,<igo
isrc:	spl 1,ipmp+3
	mov <pthink,<sgo
sgo:	spl @0,stloc
igo:	jmn @0,iploc

	end qgo
; I'm still surprised how i have fitted all this in 100 instructions!


