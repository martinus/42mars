;redcode94-nop
;name Vampire
;author Lukasz Adamowski
;assert 1

teeth   jmp     $pit+1, $-2
        dat     $0,     $0
        dat     $0,     $0
        dat     #-85,   #87
        dat     $0,     $0
start
vamp    ;spl    #0,     <teeth+1
        add     $-2,    $teeth
        mov     $teeth, <teeth
        jmp     $-2,    <teeth
        dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
        dat     $0,     $0
pit     spl     $1,     {vamp-14
        mov     $vamp-14,       {vamp-15
        mov     $vamp-14,       {vamp-15
        jmp     $-3,    {vamp-14

        end     start
