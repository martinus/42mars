;redcode
;name Prometheus (decoy)
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

        step   equ gap*2
        gap    equ 13

        bdist  equ 6199
        first  equ scan+step

scan    sub    inc,        ptrs
ptrs    cmp    first+gap,  first
        slt    #inc+4-ptrs,ptrs
        djn    scan,       <-1242

wipe    mov    @jbmb,      @ptrs
        mov    sbmb,       <ptrs
        sub    adj,        ptrs
        jmn    ptrs,       scan

sbmb    spl    0,          <clear-gap
clear   mov    adj,        <-2
jbmb    jmp    clear,      inc+1

adj     dat    <-gap,      <-gap-1
inc     spl    <-step,     <-step

boot    mov    <jbmb,      <to
        mov    <jbmb,      <to
        mov    <jbmb,      <to
        mov    <jbmb,      <to
        mov    <jbmb,      <to
        djn    boot+1,     #3

to      djn    bdist+1,    #bdist+13

a       for    MAXLENGTH-CURLINE
        spl    a%gap,      1
        rof

        end    boot

