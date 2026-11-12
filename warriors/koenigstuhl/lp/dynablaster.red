;redcode-lp
;name DynaBlasters
;author G.Labarga
;assert CORESIZE==8000
;strategy Dynahill P-warrior
;strategy double core clear or stone
;strategy different stones depending settings
;strategy I should boot both the stone and the clear too but i'm too lazy now

org start

;--- SSD clear (twin)
gate:	dat 3,500
	dat 0,0
	dat -3,8
sbm:	spl #-20,8
	mov @bpt,>gate
	mov @bpt,>gate
bpt:	djn.f -2,{sbm
for 40
	dat 0,0
rof
;--- Stone from Ethanol vE for '94 opponents
	STEP EQU 671*4
	DIST EQU CHK+2*STEP
	DIST2 EQU DIST+(1695*STEP)+1
	GATE EQU SCL-3

SCL:	SPL #0,>GATE-140
CLR:	MOV CBM,>GATE
	DJN.F CLR,>GATE
FOR 10
	DAT 0,0
ROF
CBM:	DAT <2667,9
FOR 34
	DAT 0,0
ROF
Stone:	SPL #-2*STEP,<-2*STEP
REF:	MOV {DIST2,*DIST
	MOV BMB,@REF
CHK:	SUB.F Stone,REF
	DJN.F @CHK,{CHK+3692	;<- This location is bombed after ~308*2 cycles
FOR 6
	DAT 0,0
ROF
BMB:	DAT STEP,SCL-CHK	;A-field could be greater
for 40
	dat 0,0
rof
;--- stone for LP opponents
step equ 4954

acsto:	mov {1601,1-step	;Stone from Alladin's Cave, by P.Kline
	sub.x #step,-1
	jmp -2,}-2
for 6
	dat 0,0
rof
boot:	mov <sgo,{sgo
	mov <sgo,{sgo
	mov <sgo,{sgo
sgo:	djn.f acsto-1003,acsto+3
for 10
	dat 0,0
rof
;--- Processes check and P^3
D_RESULT EQU 0
D_STATE EQU 1

start:	ldp.a #0,savset
	jmz ctwk,*start
	ldp #2,#0
	sne #1,-1
	mov stwk,acsto
P3:	LDP.A #D_RESULT,RESULT	;P-Brain
	LDP.BA 2,STATE
	MOD.BA *RESULT,STATE
	STP.B *STATE,#D_STATE
STATE:	JMP }0,#106
TABLE:	dat clear,176
	dat clear,51
	dat clear,52
	dat acsto,179
	dat acsto,19
RESULT:	dat 0,6
	dat 0,5
	dat 0,7

stwk:	jmp Stone+acsto,{0
	spl 2,}0
ctwk:	mov.i -1,clgo-1
	STP.B *STATE,STATE-1	;save state 0
clear:	spl 1,bpt+2
	spl 1
	mov <-2,{scnd
	mov <-3,{scnd
scnd:	spl *bpt+4002
	jmp sbm		;No, it's not a bug...
clgo	jmp sbm
savset	stp #1,#112
end

