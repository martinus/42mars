;redcode
;name LEX2
;author Marco Pontello
;assert 1

Dest    Equ     2500                    ; Offset Rilocazione
WarZone Equ     3000                    ; Dimensione area da bombardare
First   Equ     (8192-WarZone/2+WarZone); Obiettivo prima bomba
Step1   Equ     7                       ; Step per bombe paralizzanti
Step2   Equ     2                       ; Step per bombe
Count   Equ     (WarZone/Step1)         ; Numero di colpi da sparare

Start   Mov     15,Dest                 ; Inizio rilocazione
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Mov     15,Dest
        Jmp     Start+Dest+4            ; Salto alla copia
Trg1    Dat     #0
Pointer Dat     #First
Freeze1 Spl     0
Freeze2 Jmp     -1
Loop    Mov     Freeze2,@Pointer        ; Bombardamento paralizzante
        Mov     Freeze1,<Pointer
        Sub     #(Step1-1),Pointer
        Djn     Loop,#Count
Fire    Sub     #Step2,Trg1             ; Bombardamento a tappeto Fw/Bk
        Add     #Step2,Trg2
        Mov     Pointer,@Trg1
        Mov     Pointer,@Trg2
        Jmp     Fire
Trg2    Dat     #0
        End     Start
