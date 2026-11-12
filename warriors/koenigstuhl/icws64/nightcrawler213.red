;redcode-ICWS
;name NightCrawler 2^13
;author Wayne Sheppard
;contact wayne.sheppard@gmail.com
;assert CORESIZE==8192

imp  equ impcopy+1700  ;imp start
hide equ 1600         ;stone location

stone spl 0,<-100
mov <-41,1-3598
add 1,-1
jmp -2,<-3598

start mov stone+3,hide         ;Copy stone
mov stone+2,<start
mov stone+1,<start
mov stone,<start
spl @start,<4000


;bimp 8192 2731 8 imp
;Binary imp launch
SPL 8
SPL 4
SPL 2
JMP imp+0
JMP imp+2731
SPL 2
JMP imp+5462
JMP imp+1
SPL 4
SPL 2
JMP imp+2732
JMP imp+5463
SPL 2
JMP imp+2
MOV impcopy,imp

impcopy mov 0,2731

FOR MAXLENGTH-CURLINE
mov 0,2667
ROF
end start

