;redcode-lp
;author inversed
;name Steam-Powered Tank
;strategy jmp 0 bomber
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

hop     equ     4*11
step    equ     2*hop
time    equ     999
ofs     equ     hit+step    ; = hit-step*time

safe    equ     8
hit     equ     ptr+2
cptr    equ     ptr+1
gate    equ     ptr-2

org     check
        
ptr     mov       step      ,   > ofs
        add.ab  { 0         ,   } 0
check   mov       bomb      ,   @ ptr   ;hit
        jmn       ptr       ,   @ check
        spl     # 0         ,     0
clear   mov     * ptr       ,   > cptr
        jmp       clear     ,   < gate
        dat       0         ,     0     ;hit
kill    dat       kill-ptr  ,     safe

for     step-9
        dat       0         ,     0
rof

bomb    jmp     # kill-ptr  ,     hop+1

