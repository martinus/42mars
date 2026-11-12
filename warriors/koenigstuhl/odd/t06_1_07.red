;redcode
;name Ping
;author Fluffy
;strategy paper
;assert 1

        ORG     boot

;;
;; boot
;;

        pAway1  EQU     2279
        pAway2  EQU     7774
        decoy   EQU     4352

boot    spl     } 1,                    < 1000
        spl     0,                      > 2000
        spl     1,                      < 3000

        ; boot two copies of the paper

        mov.i   { silk1,                { pBoot1
pBoot1  spl     pAway1,                 { pAway2 + pBoot2

        mov.i   } pBoot1,               > pBoot1
pBoot2  djn.f   pAway2,                 { decoy

for 100
        dat.f   0,                      0
rof

;;
;; paper
;;
pStep1 EQU 4933
pStep2 EQU 2664
pStep3 EQU 4363

iStep EQU    1
x EQU 830
y EQU 2082

silk1 spl @ silk1 + 8, < pStep1
mov.i } silk1, > silk1

silk2 spl @ silk2, { pStep2
mov.i } silk2, > silk2

silk3 spl @ silk3, < pStep3
mov.i } silk3, > silk3

mov.i # iStep, { 1
mov.i x, < y

