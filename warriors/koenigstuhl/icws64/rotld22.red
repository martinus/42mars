;redcode
;name RotLD 2.2
;author Nandor Sieben
;strategy Return of the Living Dead 2.2
;strategy 8 living deads
;strategy synchronized starting routine
;assert CORESIZE==8192

start   MOV     dead , 1031     ; copy the living deads
        MOV   living , <start
        MOV   return , <start
s2      MOV     dead , 2029
        MOV   living , <s2
        MOV   return , <s2
s3      MOV     dead , 3029
        MOV   living , <s3
        MOV   return , <s3
s4      MOV     dead , 4027
        MOV   living , <s4
        MOV   return , <s4
s5      MOV     dead , 5027
        MOV   living , <s5
        MOV   return , <s5
s6      MOV     dead , 6025
        MOV   living , <s6
        MOV   return , <s6
s7      MOV     dead , 7025
        MOV   living , <s7
        MOV   return , <s7
j0      spl     j2
j1      spl     j4
j3      spl     j8
j7      jmp     @start          ; start them
j2      spl     j6
j5      spl     j12
j11     jmp     @s2
j4      spl     j10
j9      jmp     @s3
j6      spl     j14
j13     jmp     @s4
j8      jmp     @s5
j10     jmp     @s6
j12     jmp     @s7
j14     JMP     return

ptr     dat     #0
        dat     #0
return  SPL     0    , <ptr
living  MOV     ptr  , <ptr
dead    djn   return , <ptr
        END     start

