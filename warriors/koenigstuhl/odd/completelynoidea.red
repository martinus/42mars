;redcode
;name Completely no idea
;author Lukasz Adamowski
;assert 1

bomb    dat        $13,        $0
        seq        $0,        $0
        sne        $0,        $0
        dat        $0,        $0
start   spl        1,        {5
        spl        1,        {5
        spl        1,        {5
        mov        bomb,        <bomb
        djn        $-1,        <bomb
        dat        $0,        $0

        end        start