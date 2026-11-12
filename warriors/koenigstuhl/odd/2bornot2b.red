;redcode-94t
;name 2b||!2b
;author Sascha Zapf
;       CORESIZE==8192
;assert 1
;strategy Scissor or Paper/Stone
;kill 2b||!2b

step  equ 12
first equ 442
dist  equ 2550
time  equ 323

scboot equ 537

sclaunch	mov.i <scjump,{scjump
			djn.b -1,#9
scjump		jmp		scboot,db+1

ptr:    sne   first,    first+dist
        add   db,       ptr
p:      mov   bomb,     }ptr
        mov   bomb,     >ptr
        djn   @p,       #time

bomb:   spl   #1,       1
        mov   db,       >ptr
		djn.f -1,       >ptr
db:     dat   step-1,   step-1



for 30
dat 0,0
rof

; 133
	 pStep1 equ 2216
     pStep2 equ 4640
     pStep3 equ 1573
	pStep4 equ 338

	 x equ1569
     y equ272

pap1:spl   @0,  <pStep1
     mov.i }pap1,  >pap1
pap2:spl   @0,     {pStep2
     mov.i }pap2,  >pap2
pap3:spl   @0,     {pStep3
	 mov.i }pap3, >pap3
	 mov.i #1,     {1
     mov   x,      <y
     mov.i {pap3,  <pap4
pap4:jmz.a @0,     pStep4
pEnd:


paperboot equ 2895
stoneboot equ 3260

for 20
dat 0,0
rof

pslaunch	spl 1,<2565
			mov.i <0,0
			mov.i <0,0
			mov.i	<startstone,{startstone
			spl 1,<2762
			mov.i <startpaper,{startpaper
startpaper	spl paperboot,pap4+1				; endmarkierung paper
startstone	jmp	stoneboot,sBmb+1

for 30
dat 0,0
rof

sStep 	equ  	629
sTime 	equ  	3434

sSpl    spl     #0 		, #0
sMov    mov     sBmb 		, @sDjn
sInc    add     #sStep 		, sDjn
sDjn    djn.f   sMov 		, {sInc-(sTime*sStep)
sBmb    dat     >1518 		, >1    ;war 4

for 20
dat 0,0
rof

pResult equ 0
pNum equ 2
pSpace1 equ     1               ; used to store the current strategy
pSpace2 equ     2               ; used to store the loss counter
pLosses equ     3               ; how many losses before we switch

pGo     ldp.ab  #pResult,#0
        ldp.a   #pSpace1,pTable
pJump   jmn.b   pWin,pGo
pLoss   ldp.ab  #pSpace2,#0
        nop.f   >pLoss,}7800
        mod.ab  #pLosses,pLoss
pThink  jmn.b   pWin,pLoss
        nop.f   }pTable,}7024
        stp.ab  pTable,#pSpace1
pWin    stp.b   pLoss,#pSpace2
        mod.a   #pNum,pTable
pTable  jmp.a   @0,sclaunch
        dat.f   0,pslaunch

        end     pGo
