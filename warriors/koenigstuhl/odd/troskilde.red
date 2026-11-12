;redcode-lp
;name tiny Roskilde
;author Christian Schmidt
;strategy 3 stones with 1 proc each
;strategy 5 procs for the paper
;assert 1

;optimax 1234
;optimax work tlp-xxx
;optimax rounds 1 200 250 250
;optimax suite fshtinylp

;optimax phase2 fshtinylp/pap/silklander.red
;optimax phase2 150

;optimax phase3 top20
;optimax phase3 pap:scn
;optimax phase3 178

;optimax phase4 top20
;optimax phase4 100%

sAwa1   equ   529
sAwa2   equ   86
sAwa3   equ   754
sStep   equ   92

pStep1  equ   368
pStep2  equ   442

zero    equ     qbomb
qtab3   equ     qbomb

p1      mov     #6,             #6
pGo     mov     <p1,            <j1
        jmn     -1,             @-2
        spl     @p1,            <pStep2
j1      jmz.b   @0,             pStep1
b1      dat     {390,            {593

        for     20
        dat     0,              0
        rof


xGo     spl     pGo,            >592
qtab2   spl     2,              {688
        spl     1,              {200

        mov     <s1,            {s1
        mov     <s2,            {s2
        mov     <s3,            {s3
        jmp     *s1,            }0

s1      dat     p1+sAwa1,       sEnd+1
s2      dat     p1+sAwa2,       sEnd+1
s3      dat     p1+sAwa3,       sEnd+1

Stone   mov    	{454,1-sStep
        sub.x  	#sStep   ,-1
sEnd    jmp    	-2       ,}-2


end xGo
