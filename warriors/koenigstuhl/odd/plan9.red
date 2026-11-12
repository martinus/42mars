;redcode-DS
;name Plan 9
;author inversed
;strategy Paper
;kill Blottery
;assert 1

pStep1 equ 2618
pStep2 equ 5067
pStep3 equ 683
bStep2 equ 6617
bStep3 equ 4506

spl 1 , 0
mov -1 , 0
mov -1 , 0
mov -1 , 0

mov bomb + 1 , } silk1

silk1 spl @-9 , > pStep1
mov } silk1 , > silk1
silk2 spl @ 0 , > pStep2
mov } silk2 , > silk2
mov bomb , > bStep2
mov bomb , } bStep3
mov { silk2 , < silk3
silk3 jmp @ 0 , > pStep3
bomb dat < 2667 , < 5334


