;redcode-icws
;name Prometheus
;author John Metcalf
;strategy scanner
;assert CORESIZE==8192

        step   equ gap*2
        gap    equ 22

        first  equ scan+gap*22

scan    sub    inc,         ptrs
ptrs    cmp    first+gap,   first
        slt    #inc+4-ptrs, ptrs
        djn    scan,        <3242

wipe    mov    @jbmb,       @ptrs
        mov    sbmb,        <ptrs
        sub    adj,         ptrs
        jmn    ptrs,        scan

sbmb    spl    0,           <clear-gap
clear   mov    adj,         <-2
jbmb    jmp    clear

adj     dat    <-gap,       <-gap-1
inc     spl    <-step,      <-step

        end    ptrs

